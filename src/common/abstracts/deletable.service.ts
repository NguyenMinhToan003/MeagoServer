import { NotFoundException } from '@nestjs/common';
import { EntityManager, ObjectLiteral } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BaseService } from './base.service';

/**
 * Mở khoá xoá (mềm + cứng) cho service con.
 * BaseService không có 3 method này — entity nào không được phép xoá (vd audit log)
 * thì service tương ứng chỉ extends BaseService, gọi softRemove/hardRemove sẽ lỗi compile.
 */
export abstract class DeletableService<
  T extends BaseEntity & ObjectLiteral,
> extends BaseService<T> {
  /** Xoá mềm 1 bản ghi — set deletedAt, có thể restore lại. */
  async softRemove(id: string, manager?: EntityManager): Promise<void> {
    const result = await this.getRepoManager(manager).softDelete(id);
    if (!result.affected) throw new NotFoundException(`${this.objectName} not found`);
  }

  /** Khôi phục bản ghi đã xoá mềm. */
  async restore(id: string, manager?: EntityManager): Promise<void> {
    const result = await this.getRepoManager(manager).restore(id);
    if (!result.affected) throw new NotFoundException(`${this.objectName} not found`);
  }

  /** Xoá vĩnh viễn — dùng cho GDPR/compliance, không thể khôi phục. */
  async hardRemove(ids: string[], manager?: EntityManager): Promise<void> {
    await this.getRepoManager(manager).delete(ids);
  }
}
