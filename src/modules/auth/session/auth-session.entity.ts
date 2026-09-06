import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { AuthSessionData } from 'src/common/auth/session-store.port';

/**
 * Stateful session (AUTH_MODE=session). Bảng riêng, không dùng chung với
 * refresh_sessions của JWT mode — hai strategy độc lập hoàn toàn.
 * PK là SHA-256 của session ID thô trong cookie.
 */
@Entity('auth_sessions')
export class AuthSessionEntity {
  @PrimaryColumn({ length: 64 })
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  subjectId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  /** idle expiry — trượt theo lần touch gần nhất */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** absolute expiry — rotate/touch bao nhiêu lần cũng không sống quá mốc này */
  @Column({ type: 'timestamptz' })
  absoluteExpiresAt: Date;

  @Column({ type: 'timestamptz' })
  lastSeenAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** id của session thay thế khi rotate */
  @Column({ type: 'varchar', length: 64, nullable: true })
  replacedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: AuthSessionData | null;
}
