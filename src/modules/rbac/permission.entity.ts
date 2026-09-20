import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/abstracts/base.entity';

/** Permission là DATA, dạng "resource:action" — vd "story:create", "user:ban". */
@Entity('permissions')
export class PermissionEntity extends BaseEntity {
  /** Unique thật thi hành bằng partial index (chỉ áp cho hàng chưa xoá mềm) — xem migration. */
  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true })
  description: string;
}
