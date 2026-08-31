import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import dayjs from 'dayjs';
import authConfig from 'src/configs/auth.config';
import { UsersService } from 'src/modules/users/users.service';
import { EUserStatus, UserEntity } from 'src/modules/users/user.entity';
import { RefreshSessionEntity } from './refresh-session.entity';

export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
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
  ) {}

  async register(email: string, displayName: string, password: string): Promise<UserEntity> {
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    return this.usersService.create({
      email,
      displayName,
      passwordHash: await bcrypt.hash(password, 10),
    });
  }

  async login(email: string, password: string, meta: IClientMeta): Promise<ITokenPair> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== EUserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is blocked');
    }

    return this.dataSource.transaction(async (manager) => {
      const issued = await this.issueTokenPair(
        manager.getRepository(RefreshSessionEntity),
        user,
        crypto.randomUUID(),
        meta,
      );
      return issued.pair;
    });
  }

  async refresh(rawToken: string, meta: IClientMeta): Promise<ITokenPair> {
    const tokenHash = this.hash(rawToken);
    const outcome = await this.dataSource.transaction<RefreshOutcome>(async (manager) => {
      const repo = manager.getRepository(RefreshSessionEntity);
      const session = await repo
        .createQueryBuilder('session')
        .setLock('pessimistic_write')
        .where('session.tokenHash = :tokenHash', { tokenHash })
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
    });

    if (!outcome.ok) throw outcome.error;
    return outcome.pair;
  }

  async logout(rawToken: string): Promise<void> {
    await this.sessionRepo.update(
      { tokenHash: this.hash(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.sessionRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
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
      pair: { accessToken, refreshToken, refreshExpiresAt },
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

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
