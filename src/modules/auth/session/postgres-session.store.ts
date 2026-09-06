import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import authConfig from 'src/configs/auth.config';
import { runInTransaction } from 'src/database/concurrency';
import { AuthSessionRecord, AuthSessionStore } from 'src/common/auth/session-store.port';
import { AuthSessionEntity } from './auth-session.entity';

/** Nguồn sự thật của stateful session. */
@Injectable()
export class PostgresSessionStore implements AuthSessionStore {
  constructor(
    @InjectRepository(AuthSessionEntity) private readonly repo: Repository<AuthSessionEntity>,
    private readonly dataSource: DataSource,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
  ) {}

  async create(session: AuthSessionRecord): Promise<void> {
    await this.repo.insert(this.toEntity(session));
  }

  async findById(id: string): Promise<AuthSessionRecord | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<boolean> {
    const result = await this.repo.update({ id, revokedAt: IsNull() }, { lastSeenAt, expiresAt });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Conditional UPDATE trên row hiện tại là điểm serialize: hai renew đồng thời
   * chỉ một cái affected = 1, cái còn lại nhận false — không cần advisory lock.
   */
  async rotate(currentId: string, successor: AuthSessionRecord): Promise<boolean> {
    return runInTransaction(
      this.dataSource,
      async (manager) => {
        const repo = manager.getRepository(AuthSessionEntity);
        const burned = await repo.update(
          { id: currentId, revokedAt: IsNull() },
          { revokedAt: successor.createdAt, replacedBy: successor.id },
        );
        if ((burned.affected ?? 0) !== 1) return false;
        await repo.insert(this.toEntity(successor));
        return true;
      },
      { lockTimeoutMs: this.conf.transactionLockTimeoutMs },
    );
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.repo.update({ id, revokedAt: IsNull() }, { revokedAt });
  }

  async revokeAll(subjectId: string, revokedAt: Date): Promise<void> {
    await this.repo.update({ subjectId, revokedAt: IsNull() }, { revokedAt });
  }

  private toEntity(session: AuthSessionRecord): AuthSessionEntity {
    return this.repo.create({
      id: session.id,
      subjectId: session.subjectId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      lastSeenAt: session.lastSeenAt,
      revokedAt: session.revokedAt,
      replacedBy: null,
      ip: session.context?.ip ?? null,
      userAgent: session.context?.userAgent ?? null,
      data: session.data ?? null,
    });
  }

  private toRecord(row: AuthSessionEntity): AuthSessionRecord {
    return {
      id: row.id,
      subjectId: row.subjectId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      absoluteExpiresAt: row.absoluteExpiresAt,
      lastSeenAt: row.lastSeenAt,
      revokedAt: row.revokedAt,
      context: { ip: row.ip ?? undefined, userAgent: row.userAgent ?? undefined },
      data: row.data ?? undefined,
    };
  }
}
