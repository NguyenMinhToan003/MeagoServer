import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, QueryFailedError, Repository } from 'typeorm';
import * as crypto from 'crypto';
import dayjs from 'dayjs';
import authConfig from 'src/configs/auth.config';
import { UsersService } from 'src/modules/users/users.service';
import { EUserStatus, UserEntity } from 'src/modules/users/user.entity';
import { RefreshSessionEntity } from './refresh-session.entity';
import { PASSWORD_HASHER, PasswordHasher } from 'src/common/security/password-hasher.port';
import {
  acquireTransactionAdvisoryLock,
  runInTransaction as runDatabaseTransaction,
} from 'src/database/concurrency';

const AUTH_USER_LOCK_NAMESPACE = 1_294_638_201;
const AUTH_FAMILY_LOCK_NAMESPACE = 1_294_638_202;

export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  /** Internal audit/session context; controllers do not expose these fields. */
  userId: string;
  sessionId: string;
}

export interface IClientMeta {
  deviceInfo?: string;
  ip?: string;
}

type RefreshOutcome =
  { ok: true; pair: ITokenPair } | { ok: false; error: UnauthorizedException | ConflictException };

interface IssuedTokenPair {
  pair: ITokenPair;
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshSessionEntity)
    private readonly sessionRepo: Repository<RefreshSessionEntity>,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
    private readonly dataSource: DataSource,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(email: string, displayName: string, password: string): Promise<UserEntity> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.usersService.findByEmail(normalizedEmail)) {
      throw new ConflictException('Email already registered');
    }
    try {
      return await this.usersService.create({
        email: normalizedEmail,
        displayName: displayName.trim(),
        passwordHash: await this.passwordHasher.hash(password),
      });
    } catch (error) {
      if (this.isEmailUniqueViolation(error)) {
        throw new ConflictException({
          code: 'AUTH_EMAIL_ALREADY_EXISTS',
          message: 'Email already registered',
        });
      }
      throw error;
    }
  }

  async login(email: string, password: string, meta: IClientMeta): Promise<ITokenPair> {
    const user = await this.usersService.findByEmail(email.trim().toLowerCase());
    const passwordMatches = await this.passwordHasher.verifyOrDummy(
      user?.passwordHash ?? null,
      password,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== EUserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is blocked');
    }

    return runDatabaseTransaction(
      this.dataSource,
      async (manager) => {
        await this.lockUser(manager, user.id);
        const currentUser = await this.usersService.findOneById(user.id, manager);
        if (!currentUser || currentUser.status !== EUserStatus.ACTIVE) {
          throw new UnauthorizedException('Account unavailable');
        }
        const issued = await this.issueTokenPair(
          manager.getRepository(RefreshSessionEntity),
          currentUser,
          crypto.randomUUID(),
          meta,
        );
        return issued.pair;
      },
      { lockTimeoutMs: this.conf.transactionLockTimeoutMs },
    );
  }

  async refresh(rawToken: string, meta: IClientMeta): Promise<ITokenPair> {
    const tokenHash = this.hash(rawToken);
    const identity = await this.sessionRepo.findOne({
      select: { id: true, userId: true, familyId: true },
      where: { tokenHash },
    });
    if (!identity) throw new UnauthorizedException('Invalid refresh token');

    const outcome = await runDatabaseTransaction<RefreshOutcome>(
      this.dataSource,
      async (manager) => {
        const repo = manager.getRepository(RefreshSessionEntity);
        // Every auth flow takes locks in the same order to avoid deadlocks.
        await this.lockUser(manager, identity.userId);
        await this.lockFamily(manager, identity.familyId);
        const session = await repo
          .createQueryBuilder('session')
          .setLock('pessimistic_write')
          .where('session.id = :id AND session.tokenHash = :tokenHash', {
            id: identity.id,
            tokenHash,
          })
          .getOne();

        if (!session) {
          return { ok: false, error: new UnauthorizedException('Invalid refresh token') };
        }

        if (session.replacedBy) {
          if (this.isRecentRotation(session.revokedAt)) {
            return {
              ok: false,
              error: new ConflictException({
                code: 'AUTH_REFRESH_RACE',
                message: 'Refresh already completed by another request',
              }),
            };
          }
          await this.revokeFamily(session.familyId, repo);
          return { ok: false, error: new UnauthorizedException('Refresh token reuse detected') };
        }

        if (session.revokedAt) {
          return { ok: false, error: new UnauthorizedException('Refresh token revoked') };
        }
        if (!dayjs().isBefore(session.expiresAt)) {
          return { ok: false, error: new UnauthorizedException('Refresh token expired') };
        }

        const user = await this.usersService.findOneById(session.userId, manager);
        if (!user || user.status !== EUserStatus.ACTIVE) {
          await this.revokeFamily(session.familyId, repo);
          return { ok: false, error: new UnauthorizedException('Account unavailable') };
        }

        const issued = await this.issueTokenPair(
          repo,
          user,
          session.familyId,
          meta,
          session.expiresAt,
        );
        await repo.update(session.id, {
          revokedAt: new Date(),
          replacedBy: issued.sessionId,
        });
        return { ok: true, pair: issued.pair };
      },
      { lockTimeoutMs: this.conf.transactionLockTimeoutMs },
    );

    if (!outcome.ok) throw outcome.error;
    return outcome.pair;
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    const identity = await this.sessionRepo.findOne({
      select: { id: true, userId: true, familyId: true },
      where: { tokenHash },
    });
    if (!identity) return;

    await runDatabaseTransaction(
      this.dataSource,
      async (manager) => {
        await this.lockUser(manager, identity.userId);
        await this.lockFamily(manager, identity.familyId);
        await manager
          .getRepository(RefreshSessionEntity)
          .update({ id: identity.id, revokedAt: IsNull() }, { revokedAt: new Date() });
      },
      { lockTimeoutMs: this.conf.transactionLockTimeoutMs },
    );
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await runDatabaseTransaction(
      this.dataSource,
      async (manager) => {
        await this.lockUser(manager, userId);
        await manager
          .getRepository(RefreshSessionEntity)
          .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      },
      { lockTimeoutMs: this.conf.transactionLockTimeoutMs },
    );
  }

  private async issueTokenPair(
    repo: Repository<RefreshSessionEntity>,
    user: UserEntity,
    familyId: string,
    meta: IClientMeta,
    absoluteExpiresAt?: Date,
  ): Promise<IssuedTokenPair> {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshExpiresAt =
      absoluteExpiresAt ?? dayjs().add(this.conf.refreshTtlDays, 'day').toDate();
    const session = await repo.save(
      repo.create({
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        familyId,
        deviceInfo: meta.deviceInfo,
        ip: meta.ip,
        expiresAt: refreshExpiresAt,
      }),
    );

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, sid: session.id, email: user.email },
      {
        secret: this.conf.accessSecret,
        algorithm: 'HS256',
        issuer: this.conf.issuer,
        audience: this.conf.audience,
        jwtid: crypto.randomUUID(),
        expiresIn: this.conf.accessTtl as JwtSignOptions['expiresIn'],
      },
    );
    return {
      pair: {
        accessToken,
        refreshToken,
        refreshExpiresAt,
        userId: user.id,
        sessionId: session.id,
      },
      sessionId: session.id,
    };
  }

  private async revokeFamily(
    familyId: string,
    repo: Repository<RefreshSessionEntity> = this.sessionRepo,
  ): Promise<void> {
    await repo.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private isRecentRotation(revokedAt: Date | null): boolean {
    if (!revokedAt) return false;
    return dayjs().diff(dayjs(revokedAt), 'second', true) <= this.conf.refreshRaceGraceSeconds;
  }

  private lockUser(manager: EntityManager, userId: string): Promise<void> {
    return acquireTransactionAdvisoryLock(manager, AUTH_USER_LOCK_NAMESPACE, userId);
  }

  private lockFamily(manager: EntityManager, familyId: string): Promise<void> {
    return acquireTransactionAdvisoryLock(manager, AUTH_FAMILY_LOCK_NAMESPACE, familyId);
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private isEmailUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as { code?: string; constraint?: string };
    return (
      driverError.code === '23505' &&
      ['UQ_users_email', 'UQ_users_email_normalized'].includes(driverError.constraint ?? '')
    );
  }
}
