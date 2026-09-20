import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeletableService } from 'src/common/abstracts/deletable.service';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService extends DeletableService<UserEntity> {
  constructor(@InjectRepository(UserEntity) repo: Repository<UserEntity>, dataSource: DataSource) {
    super(
      repo,
      UserEntity,
      dataSource,
      'User',
      ['email', 'displayName'],
      ['createdAt', 'updatedAt', 'email', 'displayName', 'status'],
    );
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }
}
