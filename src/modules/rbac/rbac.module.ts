import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/modules/users/user.entity';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';

/** Global vì PermissionsGuard (APP_GUARD) cần RbacService ở mọi nơi. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, PermissionEntity, UserEntity])],
  controllers: [RbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
