import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { EUserStatus } from 'src/modules/users/user.entity';

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
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const config = {
    accessSecret: 'test-secret-at-least-16-characters',
    accessTtl: '15m',
    issuer: 'meago-server',
    audience: 'meago-client',
    refreshTtlDays: 14,
    refreshRaceGraceSeconds: 5,
    refreshCookieName: 'meago_rt',
    permissionCacheTtlMs: 300000,
  };
  const dataSource = {
    transaction: jest.fn(async (work) => work({ getRepository: () => sessionRepo })),
  };
  const service = new AuthService(
    usersService as never,
    jwtService as never,
    sessionRepo as never,
    config,
    dataSource as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('does not reveal whether an email exists during login', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    await expect(service.login('missing@meago.test', 'password', {})).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('issues an access token and stores only a refresh-token hash', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@meago.test',
      passwordHash,
      status: EUserStatus.ACTIVE,
    });
    jwtService.signAsync.mockResolvedValue('access-token');

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
    expect(sessionRepo.update).toHaveBeenCalledWith('old', {
      revokedAt: expect.any(Date),
      replacedBy: 'session-1',
    });
  });
});
