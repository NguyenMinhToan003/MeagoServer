import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TypeORMError } from 'typeorm';
import * as Sentry from '@sentry/nestjs';

/** Shape lỗi thống nhất (theo errors.middleware của source mẫu). */
const buildBody = (
  status: number,
  error: string,
  message: unknown,
  req: Request,
  metadata: { code?: string; details?: unknown } = {},
) => ({
  statusCode: status,
  error,
  message,
  path: req.url,
  timestamp: new Date().toISOString(),
  ...(metadata.code === undefined ? {} : { code: metadata.code }),
  ...(metadata.details === undefined ? {} : { details: metadata.details }),
});

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const status = exception.getStatus();
    const resBody = exception.getResponse() as {
      message?: unknown;
      error?: string;
      code?: string;
      details?: unknown;
    };
    if (status >= 500) Sentry.captureException(exception);
    ctx
      .getResponse<Response>()
      .status(status)
      .json(
        buildBody(
          status,
          resBody.error ?? exception.name,
          resBody.message ?? exception.message,
          ctx.getRequest<Request>(),
          { code: resBody.code, details: resBody.details },
        ),
      );
  }
}

@Catch(TypeORMError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TypeOrmExceptionFilter.name);

  catch(exception: TypeORMError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const driverCode = (exception as TypeORMError & { driverError?: { code?: string } }).driverError
      ?.code;
    if (driverCode && ['55P03', '40P01', '40001'].includes(driverCode)) {
      response.setHeader('Retry-After', '1');
      response
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json(
          buildBody(
            HttpStatus.SERVICE_UNAVAILABLE,
            'ConcurrencyUnavailable',
            'The operation could not acquire a database lock; retry the complete request',
            ctx.getRequest<Request>(),
            { code: 'DATABASE_CONCURRENCY_RETRY', details: { retryable: true } },
          ),
        );
      return;
    }
    this.logger.error(exception.message, exception.stack);
    Sentry.captureException(exception);
    // không leak chi tiết SQL ra ngoài
    ctx
      .getResponse<Response>()
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        buildBody(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'DatabaseError',
          'Internal server error',
          ctx.getRequest<Request>(),
        ),
      );
  }
}
