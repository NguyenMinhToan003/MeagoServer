import { NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ILike,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { BaseQueryDto } from '../dto/base-query.dto';
import { IPaginatedResult } from '../interfaces/response.interface';

/**
 * Generic CRUD service — core rút gọn từ AActionsModel của EvoAutomationServer.
 *
 * Idiom quan trọng nhất giữ lại: THREADING EntityManager.
 * Mọi method nhận `manager?: EntityManager` cuối cùng; khi được gọi trong
 * transaction thì mọi truy vấn đi qua cùng một manager (getRepoManager),
 * ngoài transaction thì dùng repo thường. Nhờ đó service con compose được
 * nhiều thao tác trong một transaction duy nhất qua runInTransaction().
 */
export abstract class BaseService<T extends ObjectLiteral> {
  protected constructor(
    protected readonly repo: Repository<T>,
    protected readonly entity: EntityTarget<T>,
    protected readonly dataSource: DataSource,
    /** tên đối tượng hiển thị trong message lỗi, vd 'User' */
    protected readonly objectName: string,
    /** các cột dùng cho ?search= (ILIKE) */
    protected readonly searchableFields: (keyof T & string)[] = [],
  ) {}

  /** Repo gắn với transaction hiện tại (nếu có) — idiom cốt lõi. */
  protected getRepoManager(manager?: EntityManager): Repository<T> {
    return manager ? manager.getRepository<T>(this.entity) : this.repo;
  }

  /** Chạy callback trong 1 transaction; truyền manager xuống các method con. */
  async runInTransaction<R>(work: (manager: EntityManager) => Promise<R>): Promise<R> {
    return this.dataSource.transaction(work);
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

  async findOneByField(where: FindOptionsWhere<T>, manager?: EntityManager): Promise<T | null> {
    return this.getRepoManager(manager).findOneBy(where);
  }

  async findMultiByField(where: FindOptionsWhere<T>, manager?: EntityManager): Promise<T[]> {
    return this.getRepoManager(manager).findBy(where);
  }

  /** Danh sách phân trang + sort + search chuẩn cho mọi module. */
  async findMulti(
    query: BaseQueryDto,
    where: FindOptionsWhere<T> = {},
    manager?: EntityManager,
  ): Promise<IPaginatedResult<T>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const searchWhere: FindOptionsWhere<T>[] =
      query.search && this.searchableFields.length
        ? this.searchableFields.map((f) => ({ ...where, [f]: ILike(`%${query.search}%`) }))
        : [where];

    const [items, totalItems] = await this.getRepoManager(manager).findAndCount({
      where: searchWhere,
      order: (query.sortBy
        ? { [query.sortBy]: query.sortDir ?? 'DESC' }
        : { createdAt: 'DESC' }) as never,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, totalItems, page, limit };
  }

  async update(id: string, dto: DeepPartial<T>, manager?: EntityManager): Promise<T> {
    const repo = this.getRepoManager(manager);
    const found = await this.findOneByIdOrFail(id, manager);
    return repo.save(repo.merge(found, dto));
  }

  async removeMulti(ids: string[], manager?: EntityManager): Promise<void> {
    await this.getRepoManager(manager).delete(ids);
  }
}
