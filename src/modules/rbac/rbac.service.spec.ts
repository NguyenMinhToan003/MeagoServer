import { BadRequestException } from '@nestjs/common';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  const calls: string[] = [];
  const userRepo = { findOne: jest.fn() };
  const roleRepo = { find: jest.fn() };
  const permissionRepo = { find: jest.fn() };
  const redis = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(async () => {
      calls.push('del');
    }),
    delByPrefix: jest.fn(async () => {
      calls.push('delByPrefix');
    }),
  };
  const lockedRow = { id: 'role-1', name: 'editor', permissions: [] as unknown[] };
  const queryBuilder = {
    setFindOptions: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    setOnLocked: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => lockedRow),
  };
  const txRepo = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    find: jest.fn(),
    save: jest.fn(async (value: unknown) => {
      calls.push('save');
      return value;
    }),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn(),
    getRepository: () => txRepo,
  };
  const dataSource = {
    transaction: jest.fn(async (...args: unknown[]) => {
      const work = args[args.length - 1] as (m: typeof manager) => Promise<unknown>;
      const result = await work(manager);
      calls.push('commit');
      return result;
    }),
  };
  const service = new RbacService(
    userRepo as never,
    roleRepo as never,
    permissionRepo as never,
    redis as never,
    { permissionCacheTtlMs: 300000, transactionLockTimeoutMs: 5000 } as never,
    dataSource as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
  });

  it('serves permissions from cache before querying the database', async () => {
    redis.getJson.mockResolvedValue(['story:read']);
    await expect(service.getUserPermissions('user-1')).resolves.toEqual(new Set(['story:read']));
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('invalidates every cached permission set only after the role update commits', async () => {
    txRepo.find.mockResolvedValue([{ name: 'story:read' }, { name: 'story:create' }]);

    await service.setRolePermissions('role-1', ['story:read', 'story:create']);

    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(calls).toEqual(['save', 'commit', 'delByPrefix']);
  });

  it('rejects unknown permissions with a stable code and never touches the cache', async () => {
    txRepo.find.mockResolvedValue([{ name: 'story:read' }]);

    await expect(
      service.setRolePermissions('role-1', ['story:read', 'nope:x']),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'RBAC_UNKNOWN_PERMISSION',
        details: { missing: ['nope:x'] },
      }),
    });
    expect(redis.delByPrefix).not.toHaveBeenCalled();
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('invalidates only the affected user after assigning roles', async () => {
    txRepo.find.mockResolvedValue([{ id: 'role-1' }]);

    await service.setUserRoles('user-1', ['role-1']);

    expect(calls).toEqual(['save', 'commit', 'del']);
    expect(redis.del).toHaveBeenCalledWith('rbac:perms:user-1');
    expect(redis.delByPrefix).not.toHaveBeenCalled();
  });

  it('rejects unknown roles', async () => {
    txRepo.find.mockResolvedValue([]);
    await expect(service.setUserRoles('user-1', ['role-x'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(redis.del).not.toHaveBeenCalled();
  });
});
