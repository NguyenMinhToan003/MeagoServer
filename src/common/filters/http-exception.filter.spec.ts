import { ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

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
