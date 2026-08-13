import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from 'src/common/abstracts/base.entity';
import { RoleEntity } from 'src/modules/rbac/role.entity';

export enum EUserStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ length: 100 })
  displayName: string;

  @Column()
  @Exclude()
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
