import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/abstracts/base.entity';

/**
 * Mỗi login = 1 session; mỗi lần refresh tạo row mới cùng familyId (rotation).
 * Token lưu dạng SHA-256 hash — lộ DB không dùng được token.
 */
@Entity('refresh_sessions')
export class RefreshSessionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'uuid' })
  @Index()
  familyId: string;

  @Column({ nullable: true })
  deviceInfo: string;

  @Column({ nullable: true })
  ip: string;

  /** absolute expiry — rotate bao nhiêu lần cũng không sống quá mốc này */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** id của session thay thế khi rotate — dùng phát hiện reuse */
  @Column({ type: 'uuid', nullable: true })
  replacedBy: string | null;
}
