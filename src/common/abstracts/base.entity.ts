import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
  Column,
} from 'typeorm';

/**
 * Base cho mọi entity: uuid PK + optimistic-lock version + timestamps.
 *
 * deletedAt: null = còn sống, có giá trị = đã xoá mềm. TypeORM tự thêm
 * "deletedAt IS NULL" vào mọi find/findOne/findAndCount mặc định — entity nào
 * không cần xoá mềm thì cột này cứ luôn null, không ảnh hưởng gì.
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

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

/**
 * Base cho entity cần audit ai tạo/sửa.
 * createdBy/updatedBy là user id dạng string (denormalized, không FK)
 * — theo convention của source mẫu, tránh join chéo module.
 */
export abstract class TrackingEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;
}
