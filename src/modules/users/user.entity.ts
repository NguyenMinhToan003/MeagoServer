import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from 'src/common/abstracts/base.entity';
import { RoleEntity } from 'src/modules/rbac/role.entity';
import { EUserStatus } from '@meago/core';

export { EUserStatus } from '@meago/core';

@Entity('users')
export class UserEntity extends BaseEntity {
  /** Unique vĩnh viễn trên toàn bảng — kể cả hàng đã xoá mềm cũng giữ email, không cho đăng ký lại. */
  @Column({ unique: true })
  email: string;

  @Column({ length: 100 })
  displayName: string;

  /** Không bao giờ đưa ra API — response luôn đi qua user.mapper.ts (toUser), không map cột này. */
  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: EUserStatus, default: EUserStatus.ACTIVE })
  status: EUserStatus;

  @ManyToMany(() => RoleEntity, { cascade: false })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'role_id' },
  })
  roles: RoleEntity[];
}
