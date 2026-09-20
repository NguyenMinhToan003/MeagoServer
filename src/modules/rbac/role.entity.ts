import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from 'src/common/abstracts/base.entity';
import { PermissionEntity } from './permission.entity';

@Entity('roles')
export class RoleEntity extends BaseEntity {
  /** Unique vĩnh viễn trên toàn bảng — kể cả hàng đã xoá mềm cũng giữ tên, không cho tạo lại trùng. */
  @Column({ unique: true, length: 50 })
  name: string;

  @Column({ nullable: true })
  description: string;

  @ManyToMany(() => PermissionEntity, { eager: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id' },
    inverseJoinColumn: { name: 'permission_id' },
  })
  permissions: PermissionEntity[];
}
