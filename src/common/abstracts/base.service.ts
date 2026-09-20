import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ILike,
  IsNull,
  Not,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { BaseQueryDto } from '../dto/base-query.dto';
import { IPaginatedResult } from '@meago/core';
import { BaseEntity } from './base.entity';
import {
  findOneForUpdate,
  LockedRowBehavior,
  OptimisticConcurrencyError,
  runInTransaction,
  TransactionOptions,
  updateWithVersion,
} from 'src/database/concurrency';

/** Cách findMulti xử lý hàng đã xoá mềm — luôn tường minh tại call site. */
export enum EDeletedFilter {
  /** Mặc định: ẩn hàng đã xoá mềm — dùng cho mọi danh sách nghiệp vụ bình thường. */
  EXCLUDE = 'exclude',
  /** Chỉ lấy hàng đã xoá mềm — màn hình thùng rác. */
  ONLY = 'only',
  /** Lấy cả hàng còn sống lẫn đã xoá mềm — audit/export. */
  ALL = 'all',
}

/**
 * Generic CRUD service.
 *
 * Idiom quan trọng nhất giữ lại: THREADING EntityManager.
 * Mọi method nhận `manager?: EntityManager` cuối cùng; khi được gọi trong
 * transaction thì mọi truy vấn đi qua cùng một manager (getRepoManager),
 * ngoài transaction thì dùng repo thường. Nhờ đó service con compose được
 * nhiều thao tác trong một transaction duy nhất qua runInTransaction().
 */
export abstract class BaseService<T extends BaseEntity & ObjectLiteral> {
  protected constructor(
    protected readonly repo: Repository<T>,
    protected readonly entity: EntityTarget<T>,
    protected readonly dataSource: DataSource,
    /** tên đối tượng hiển thị trong message lỗi, vd 'User' */
    protected readonly objectName: string,
    /** các cột dùng cho ?search= (ILIKE) */
    protected readonly searchableFields: (keyof T & string)[] = [],
    /** Explicit API allowlist; never pass an arbitrary client field to TypeORM ordering. */
    protected readonly sortableFields: (keyof T & string)[] = ['createdAt', 'updatedAt'],
  ) {}

  /** Repo gắn với transaction hiện tại (nếu có) — idiom cốt lõi. */
  protected getRepoManager(manager?: EntityManager): Repository<T> {
    return manager ? manager.getRepository<T>(this.entity) : this.repo;
  }

  /** Chạy callback trong 1 transaction; truyền manager xuống các method con. */
  async runInTransaction<R>(
    work: (manager: EntityManager) => Promise<R>,
    options: TransactionOptions = {},
  ): Promise<R> {
    return runInTransaction(this.dataSource, work, options);
  }

  async create(dto: DeepPartial<T>, manager?: EntityManager): Promise<T> {
    const repo = this.getRepoManager(manager);
    return repo.save(repo.create(dto));
  }

  async createMulti(dtos: DeepPartial<T>[], manager?: EntityManager): Promise<T[]> {
    const repo = this.getRepoManager(manager);
    return repo.save(repo.create(dtos));
  }

  async findOneById(id: string, manager?: EntityManager): Promise<T | null> {
    return this.getRepoManager(manager).findOneBy({ id } as unknown as FindOptionsWhere<T>);
  }

  /** Như findOneById nhưng throw 404 kèm objectName — dùng trong controller. */
  async findOneByIdOrFail(id: string, manager?: EntityManager): Promise<T> {
    const found = await this.findOneById(id, manager);
    if (!found) throw new NotFoundException(`${this.objectName} not found`);
    return found;
  }

  /** Row lock for critical read-decide-write flows. An active transaction is mandatory. */
  async findOneByIdForUpdate(
    id: string,
    manager: EntityManager,
    behavior: LockedRowBehavior = 'wait',
  ): Promise<T> {
    const found = await findOneForUpdate(
      manager,
      this.entity,
      { id } as unknown as FindOptionsWhere<T>,
      behavior,
    );
    if (!found) throw new NotFoundException(`${this.objectName} not found`);
    return found;
  }

  async findOneByField(where: FindOptionsWhere<T>, manager?: EntityManager): Promise<T | null> {
    return this.getRepoManager(manager).findOneBy(where);
  }

  async findMultiByField(where: FindOptionsWhere<T>, manager?: EntityManager): Promise<T[]> {
    return this.getRepoManager(manager).findBy(where);
  }

  /**
   * Danh sách phân trang + sort + search chuẩn cho mọi module.
   * deletedFilter mặc định EXCLUDE (ẩn hàng đã xoá mềm) — an toàn theo mặc định;
   * muốn xem thùng rác hoặc audit thì truyền rõ EDeletedFilter.ONLY / .ALL.
   */
  async findMulti(
    query: BaseQueryDto,
    where: FindOptionsWhere<T> = {},
    deletedFilter: EDeletedFilter = EDeletedFilter.EXCLUDE,
    manager?: EntityManager,
  ): Promise<IPaginatedResult<T>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (query.sortBy && !this.sortableFields.includes(query.sortBy)) {
      throw new BadRequestException(`Unsupported sort field: ${query.sortBy}`);
    }

    const searchWhere: FindOptionsWhere<T>[] =
      query.search && this.searchableFields.length
        ? this.searchableFields.map((f) => ({ ...where, [f]: ILike(`%${query.search}%`) }))
        : [where];

    const finalWhere: FindOptionsWhere<T>[] =
      deletedFilter === EDeletedFilter.ONLY
        ? searchWhere.map((w) => ({ ...w, deletedAt: Not(IsNull()) }))
        : searchWhere;

    const [items, totalItems] = await this.getRepoManager(manager).findAndCount({
      where: finalWhere,
      withDeleted: deletedFilter !== EDeletedFilter.EXCLUDE,
      order: (query.sortBy
        ? { [query.sortBy]: query.sortDir ?? 'DESC' }
        : { createdAt: 'DESC' }) as never,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, totalItems, page, limit };
  }

  async update(id: string, dto: DeepPartial<T>, manager?: EntityManager): Promise<T> {
    const expectedVersion = (dto as { version?: unknown }).version;
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
      throw new BadRequestException('A positive integer version is required for update');
    }

    if (!manager) {
      return this.runInTransaction((transactionManager) =>
        this.update(id, dto, transactionManager),
      );
    }

    try {
      await updateWithVersion(manager, this.entity, id, Number(expectedVersion), dto);
      return this.findOneByIdOrFail(id, manager);
    } catch (error) {
      if (error instanceof OptimisticConcurrencyError) {
        throw new ConflictException({
          code: 'OPTIMISTIC_LOCK_CONFLICT',
          message: `${this.objectName} was modified by another request`,
          details: { id, expectedVersion },
        });
      }
      throw error;
    }
  }

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
