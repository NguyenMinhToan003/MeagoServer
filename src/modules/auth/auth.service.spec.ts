import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EUserStatus } from 'src/modules/users/user.entity';
import { QueryFailedError } from 'typeorm';

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    findOneById: jest.fn(),
    create: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };
  const queryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const sessionRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ ...value, id: 'session-1' })),
    findOneBy: jest.fn(),
    findOne: jest.fn().mockResolvedValue({
      id: 'old',
      userId: 'user-1',
      familyId: 'family-1',
    }),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const config = {
    mode: 'jwt' as const,
    sessionCookieName: 'meago_sid',
    sessionIdleTtlMinutes: 30,
    sessionAbsoluteTtlDays: 14,
    sessionTouchIntervalSeconds: 60,
    sessionCacheTtlSeconds: 300,
    jwtAccessSecret: 'test-secret-at-least-16-characters',
    jwtAccessTtl: '15m',
    jwtIssuer: 'meago-server',
    jwtAudience: 'meago-client',
    jwtRefreshTtlDays: 14,
    jwtRefreshRaceGraceSeconds: 5,
    jwtRefreshCookieName: 'meago_rt',
    permissionCacheTtlMs: 300000,
    transactionLockTimeoutMs: 5000,
  };
  const transactionManager = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn().mockResolvedValue(undefined),
    getRepository: () => sessionRepo,
  };
  const dataSource = {
    transaction: jest.fn(async (...args: unknown[]) => {
      const work = args[args.length - 1] as (
        manager: typeof transactionManager,
      ) => Promise<unknown>;
      return work(transactionManager);
    }),
  };
  const passwordHasher = {
    hash: jest.fn(),
    verify: jest.fn(),
    verifyOrDummy: jest.fn(),
  };
  const service = new AuthService(
    usersService as never,
    jwtService as never,
    sessionRepo as never,
    config,
    dataSource as never,
    passwordHasher,
  );

  beforeEach(() => jest.clearAllMocks());

  it('normalizes identity fields before creating a user', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockImplementation(async (value) => value);
    passwordHasher.hash.mockResolvedValue('password-hash');

    await service.register(' Admin@Example.COM ', ' Administrator ', 'password123');

    expect(usersService.findByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        displayName: 'Administrator',
      }),
    );
  });

  it('maps the database uniqueness race to a stable conflict code', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('password-hash');
    usersService.create.mockRejectedValue(
      new QueryFailedError('INSERT INTO users', [], {
        code: '23505',
        constraint: 'UQ_users_email',
      } as Error & { code: string; constraint: string }),
    );

    await expect(
      service.register('admin@example.com', 'Admin', 'password123'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUTH_EMAIL_ALREADY_EXISTS' }),
    });
  });

  it('does not reveal whether an email exists during login', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordHasher.verifyOrDummy.mockResolvedValue(false);
    await expect(service.login('missing@meago.test', 'password', {})).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('issues an access token and stores only a refresh-token hash', async () => {
    const passwordHash = '$argon2id$test-hash';
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@meago.test',
      passwordHash,
      status: EUserStatus.ACTIVE,
    });
    usersService.findOneById.mockResolvedValue({
      id: 'user-1',
      email: 'user@meago.test',
      status: EUserStatus.ACTIVE,
    });
    jwtService.signAsync.mockResolvedValue('access-token');
    passwordHasher.verify.mockResolvedValue(true);
    passwordHasher.verifyOrDummy.mockResolvedValue(true);

    const result = await service.login('user@meago.test', 'correct-password', {
      ip: '127.0.0.1',
      deviceInfo: 'jest',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        ip: '127.0.0.1',
      }),
    );
    expect(sessionRepo.save.mock.calls[0][0].tokenHash).not.toBe(result.refreshToken);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', sid: 'session-1' }),
      expect.objectContaining({
        algorithm: 'HS256',
        issuer: 'meago-server',
        audience: 'meago-client',
        jwtid: expect.any(String),
      }),
    );
  });

  it('revokes a token family when an already-consumed refresh token is reused', async () => {
    queryBuilder.getOne.mockResolvedValue({
      id: 'old',
      familyId: 'family-1',
      revokedAt: new Date(Date.now() - 60_000),
      replacedBy: 'new',
    });

    await expect(service.refresh('reused-token', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionRepo.update).toHaveBeenCalledWith(
      { familyId: 'family-1', revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });

  it('reports a concurrent rotation without revoking the token family', async () => {
    queryBuilder.getOne.mockResolvedValue({
      id: 'old',
      familyId: 'family-1',
      revokedAt: new Date(),
      replacedBy: 'new',
    });

    await expect(service.refresh('racing-token', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUTH_REFRESH_RACE' }),
    });
    expect(sessionRepo.update).not.toHaveBeenCalled();
  });

  it('locks, rotates and burns a valid refresh token in one transaction', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    queryBuilder.getOne.mockResolvedValue({
      id: 'old',
      userId: 'user-1',
      familyId: 'family-1',
      expiresAt,
      revokedAt: null,
      replacedBy: null,
    });
    usersService.findOneById.mockResolvedValue({
      id: 'user-1',
      email: 'user@meago.test',
      status: EUserStatus.ACTIVE,
    });
    jwtService.signAsync.mockResolvedValue('rotated-access-token');

    await expect(service.refresh('valid-token', {})).resolves.toEqual(
      expect.objectContaining({ accessToken: 'rotated-access-token', refreshExpiresAt: expiresAt }),
    );
    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(transactionManager.query.mock.calls.slice(1, 3)).toEqual([
      ['SELECT pg_advisory_xact_lock($1, hashtext($2))', [1_294_638_201, 'user-1']],
      ['SELECT pg_advisory_xact_lock($1, hashtext($2))', [1_294_638_202, 'family-1']],
    ]);
    expect(sessionRepo.update).toHaveBeenCalledWith('old', {
      revokedAt: expect.any(Date),
      replacedBy: 'session-1',
    });
  });
});
