import {
  acquireTransactionAdvisoryLock,
  findOneForUpdate,
  OptimisticConcurrencyError,
  runInTransaction,
  updateWithVersion,
} from './concurrency';

class TestEntity {
  id: string;
  version: number;
  name: string;
}

describe('database concurrency foundation', () => {
  it('acquires a transaction-scoped advisory lock with a parameterized key', async () => {
    const manager = {
      queryRunner: { isTransactionActive: true },
      query: jest.fn().mockResolvedValue(undefined),
    };

    await acquireTransactionAdvisoryLock(manager as never, 42, 'aggregate-1');

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
      42,
      'aggregate-1',
    ]);
  });

  it('applies transaction-local lock timeout before executing work', async () => {
    const manager = { query: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
    };
    const work = jest.fn().mockResolvedValue('done');

    await expect(
      runInTransaction(dataSource as never, work, { lockTimeoutMs: 2_500 }),
    ).resolves.toBe('done');

    expect(manager.query).toHaveBeenCalledWith(`SELECT set_config('lock_timeout', $1, true)`, [
      '2500ms',
    ]);
    expect(work).toHaveBeenCalledWith(manager);
  });

  it('requires an active transaction for a pessimistic lock', async () => {
    const manager = { queryRunner: { isTransactionActive: false } };
    await expect(findOneForUpdate(manager as never, TestEntity, { id: '1' })).rejects.toThrow(
      'Pessimistic locks require an active transaction',
    );
  });

  it('uses FOR UPDATE and supports fail-fast lock behavior', async () => {
    const row = { id: '1', version: 1, name: 'current' };
    const query = {
      setFindOptions: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(row),
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      getRepository: jest.fn(() => ({ createQueryBuilder: () => query })),
    };

    await expect(
      findOneForUpdate(manager as never, TestEntity, { id: '1' }, 'nowait'),
    ).resolves.toBe(row);
    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(query.setOnLocked).toHaveBeenCalledWith('nowait');
  });

  it('performs optimistic update as one compare-and-swap statement', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const query = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute,
    };
    const manager = {
      createQueryBuilder: jest.fn(() => query),
      getRepository: jest.fn(() => ({ metadata: { name: 'TestEntity' } })),
    };

    await updateWithVersion(manager as never, TestEntity, 'entity-1', 3, {
      name: 'changed',
      version: 999,
    });

    expect(query.where).toHaveBeenCalledWith('"id" = :id AND "version" = :expectedVersion', {
      id: 'entity-1',
      expectedVersion: 3,
    });
    const values = query.set.mock.calls[0][0];
    expect(values.name).toBe('changed');
    expect(values.version()).toBe('"version" + 1');
  });

  it('reports a version conflict when compare-and-swap affects no row', async () => {
    const query = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const manager = {
      createQueryBuilder: jest.fn(() => query),
      getRepository: jest.fn(() => ({ metadata: { name: 'TestEntity' } })),
    };

    await expect(
      updateWithVersion(manager as never, TestEntity, 'entity-1', 3, { name: 'changed' }),
    ).rejects.toEqual(new OptimisticConcurrencyError('TestEntity', 'entity-1', 3));
  });
});
