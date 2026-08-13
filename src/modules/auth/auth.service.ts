import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import authConfig from 'src/configs/auth.config';
import { UsersService } from 'src/modules/users/users.service';
import { EUserStatus, UserEntity } from 'src/modules/users/user.entity';
import { RefreshSessionEntity } from './refresh-session.entity';

export interface ITokenPair {
  accessToken: string;
  /** opaque random token — set vào httpOnly cookie ở controller */
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface IClientMeta {
  deviceInfo?: string;
  ip?: string;
}

/**
 * Access JWT 15 phút (stateless) + opaque refresh token rotation
 * với reuse detection theo token family (xem docs/02-token-architecture.md).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshSessionEntity)
    private readonly sessionRepo: Repository<RefreshSessionEntity>,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
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
    // login mới = family mới (mỗi thiết bị một chuỗi rotation riêng)
    return this.issueTokenPair(user, uuidv4(), meta);
  }

  async refresh(rawToken: string, meta: IClientMeta): Promise<ITokenPair> {
    const session = await this.sessionRepo.findOneBy({ tokenHash: this.hash(rawToken) });
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    // token đã bị rotate hoặc revoke mà vẫn được dùng lại → nghi bị đánh cắp
    // → revoke toàn bộ family, buộc login lại
    if (session.revokedAt || session.replacedBy) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (dayjs().isAfter(session.expiresAt)) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersService.findOneById(session.userId);
    if (!user || user.status !== EUserStatus.ACTIVE) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Account unavailable');
    }

    const pair = await this.issueTokenPair(user, session.familyId, meta, session.expiresAt);
    // đánh dấu row cũ đã bị thay thế ("burn on use")
    const newSession = await this.sessionRepo.findOneBy({
      tokenHash: this.hash(pair.refreshToken),
    });
    await this.sessionRepo.update(session.id, {
      revokedAt: new Date(),
      replacedBy: newSession?.id ?? null,
    });
    return pair;
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
    user: UserEntity,
    familyId: string,
    meta: IClientMeta,
    /** giữ absolute expiry của family khi rotate */
    absoluteExpiresAt?: Date,
  ): Promise<ITokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.conf.accessSecret,
        // env là string tự do, types mới của jsonwebtoken đòi template "15m"
        expiresIn: this.conf.accessTtl as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshExpiresAt =
      absoluteExpiresAt ?? dayjs().add(this.conf.refreshTtlDays, 'day').toDate();

    await this.sessionRepo.save(
      this.sessionRepo.create({
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        familyId,
        deviceInfo: meta.deviceInfo,
        ip: meta.ip,
        expiresAt: refreshExpiresAt,
      }),
    );
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.sessionRepo.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
