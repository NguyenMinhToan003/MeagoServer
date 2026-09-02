import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

describe('AuditInterceptor', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const recordBestEffort = jest.fn().mockResolvedValue(undefined);
  const auditService = {
    recordBestEffort,
  } as unknown as AuditService;
  const request = {
    id: 'request-1',
    method: 'POST',
    baseUrl: '/api/v1/users',
    route: { path: '/:id/block' },
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1',
    user: { subjectId: '11d93ef2-e087-4a9e-a398-752a56048987' },
  };
  const response = { statusCode: 200 };
  const context = {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      action: 'users.block',
      resourceType: 'user',
      resourceIdPath: 'id',
    });
  });

  it('records a successful route without capturing its body', async () => {
    const interceptor = new AuditInterceptor(reflector, auditService);
    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({ id: 'user-1', password: 'never-log' }) }),
    );
    await Promise.resolve();

    expect(recordBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.block',
        actorId: request.user.subjectId,
        resourceId: 'user-1',
        outcome: 'success',
        requestId: 'request-1',
        routeTemplate: '/api/v1/users/:id/block',
      }),
    );
    expect(recordBestEffort).not.toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.anything() }),
    );
  });

  it('records authorization-style failures as denied with a stable reason code', async () => {
    const interceptor = new AuditInterceptor(reflector, auditService);
    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => new HttpException({ code: 'USER_BLOCK_DENIED' }, 403)),
        }),
      ),
    ).rejects.toBeInstanceOf(HttpException);
    await Promise.resolve();

    expect(recordBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'denied',
        statusCode: 403,
        reasonCode: 'USER_BLOCK_DENIED',
      }),
    );
  });

  it('does nothing for routes without audit metadata', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const interceptor = new AuditInterceptor(reflector, auditService);
    await firstValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));
    expect(recordBestEffort).not.toHaveBeenCalled();
  });
});
