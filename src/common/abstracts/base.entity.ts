import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
  Column,
} from 'typeorm';

/**
 * Base cho mọi entity: uuid PK + optimistic-lock version + timestamps.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn({ default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updatedAt: Date;
}

/**
 * Base cho entity cần audit ai tạo/sửa.
 * createdBy/updatedBy là user id dạng string (denormalized, không FK)
 * — theo convention của source mẫu, tránh join chéo module.
 */
export abstract class TrackingEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;
}
