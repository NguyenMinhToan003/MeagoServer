import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';

export type IsolationLevel =
  'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

export type LockedRowBehavior = 'wait' | 'nowait' | 'skip_locked';

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  /** PostgreSQL row-lock wait limit. Omit to use the database/session default. */
  lockTimeoutMs?: number;
}

export class OptimisticConcurrencyError extends Error {
  constructor(
    public readonly entityName: string,
    public readonly id: string,
    public readonly expectedVersion: number,
  ) {
    super(`${entityName} ${id} is no longer at version ${expectedVersion}`);
    this.name = 'OptimisticConcurrencyError';
  }
}

/**
 * PostgreSQL transaction-scoped application lock. The namespace prevents unrelated
 * lock domains from blocking each other; hash collisions only add serialization.
 */
export async function acquireTransactionAdvisoryLock(
  manager: EntityManager,
  namespace: number,
  key: string,
): Promise<void> {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error('Advisory locks require an active transaction EntityManager');
  }
  await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [namespace, key]);
}

export async function runInTransaction<R>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<R>,
  options: TransactionOptions = {},
): Promise<R> {
  if (options.lockTimeoutMs !== undefined && options.lockTimeoutMs <= 0) {
    throw new RangeError('lockTimeoutMs must be greater than zero');
  }

  const execute = async (manager: EntityManager): Promise<R> => {
    if (options.lockTimeoutMs !== undefined) {
      await manager.query(`SELECT set_config('lock_timeout', $1, true)`, [
        `${options.lockTimeoutMs}ms`,
      ]);
    }
    return work(manager);
  };

  return options.isolationLevel
    ? dataSource.transaction(options.isolationLevel as never, execute)
    : dataSource.transaction(execute);
}

/** Must be called with the EntityManager supplied by an active transaction. */
export async function findOneForUpdate<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  where: FindOptionsWhere<T>,
  behavior: LockedRowBehavior = 'wait',
): Promise<T | null> {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error('Pessimistic locks require an active transaction EntityManager');
  }

  const query = manager
    .getRepository(entity)
    .createQueryBuilder('locked_row')
    .setFindOptions({ where })
    .setLock('pessimistic_write');

  if (behavior !== 'wait') query.setOnLocked(behavior);
  return query.getOne();
}

/** Atomic compare-and-swap update for entities using the standard id/version columns. */
export async function updateWithVersion<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  id: string,
  expectedVersion: number,
  changes: DeepPartial<T>,
): Promise<void> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new RangeError('expectedVersion must be a positive integer');
  }

  const safeChanges = { ...(changes as Record<string, unknown>) };
  delete safeChanges.id;
  delete safeChanges.version;
  delete safeChanges.createdAt;
  delete safeChanges.updatedAt;

  const result = await manager
    .createQueryBuilder()
    .update(entity)
    .set({ ...safeChanges, version: () => '"version" + 1' } as never)
    .where('"id" = :id AND "version" = :expectedVersion', { id, expectedVersion })
    .execute();

  if (result.affected !== 1) {
    const entityName = manager.getRepository(entity).metadata.name;
    throw new OptimisticConcurrencyError(entityName, id, expectedVersion);
  }
}
