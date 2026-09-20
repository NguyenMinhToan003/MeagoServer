import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/abstracts/base.entity';

/** Permission là DATA, dạng "resource:action" — vd "story:create", "user:ban". */
@Entity('permissions')
export class PermissionEntity extends BaseEntity {
  /** Unique vĩnh viễn trên toàn bảng — kể cả hàng đã xoá mềm cũng giữ tên, không cho tạo lại trùng. */
  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ nullable: true })
  description: string;
}
