import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { HttpExceptionFilter, TypeOrmExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('preserves machine-readable error code and details', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/v1/auth/refresh' }),
      }),
    };
    const exception = new ConflictException({
      code: 'AUTH_REFRESH_RACE',
      message: 'Refresh already completed',
      details: { retryable: true },
    });

    new HttpExceptionFilter().catch(exception, host as never);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'AUTH_REFRESH_RACE',
        details: { retryable: true },
      }),
    );
  });
});

describe('TypeOrmExceptionFilter', () => {
  it('maps retryable PostgreSQL concurrency failures without leaking SQL', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const setHeader = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, setHeader }),
        getRequest: () => ({ url: '/api/v1/auth/refresh' }),
      }),
    };
    const exception = new QueryFailedError('SELECT secret', [], {
      code: '55P03',
    } as Error & { code: string });

    new TypeOrmExceptionFilter().catch(exception, host as never);

    expect(status).toHaveBeenCalledWith(503);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '1');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'DATABASE_CONCURRENCY_RETRY',
        details: { retryable: true },
      }),
    );
    expect(json).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
  });
});
