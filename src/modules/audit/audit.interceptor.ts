import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthPrincipal } from '@meago/core';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { AUDIT_ACTION_KEY, AuditActionOptions } from './audit-action.decorator';
import { AuditService } from './audit.service';

type AuditedRequest = Request & {
  id?: string;
  user?: AuthPrincipal;
  route?: { path?: string };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditActionOptions>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options || context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuditedRequest>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: (result) => {
          void this.auditService.recordBestEffort({
            ...this.contextFields(request, response, startedAt),
            action: options.action,
            outcome: 'success',
            resourceType: options.resourceType,
            resourceId: this.readResultPath(result, options.resourceIdPath),
          });
        },
        error: (error: unknown) => {
          const statusCode = error instanceof HttpException ? error.getStatus() : 500;
          void this.auditService.recordBestEffort({
            ...this.contextFields(request, response, startedAt),
            action: options.action,
            outcome: statusCode === 401 || statusCode === 403 ? 'denied' : 'failure',
            resourceType: options.resourceType,
            statusCode,
            reasonCode: this.reasonCode(error),
          });
        },
      }),
    );
  }

  private contextFields(request: AuditedRequest, response: Response, startedAt: number) {
    const traceHeader = request.headers.traceparent;
    const route = (request as unknown as { route?: { path?: unknown } }).route;
    const routePath = typeof route?.path === 'string' ? route.path : '';
    return {
      actorId: request.user?.subjectId ?? null,
      actorType: request.user ? ('user' as const) : ('anonymous' as const),
      requestId: request.id ?? this.singleHeader(request.headers['x-request-id']),
      traceId: this.singleHeader(traceHeader)?.split('-')[1] ?? null,
      httpMethod: request.method,
      routeTemplate: `${request.baseUrl ?? ''}${routePath}` || null,
      statusCode: response.statusCode,
      ip: request.ip,
      userAgent: this.singleHeader(request.headers['user-agent']),
      durationMs: Date.now() - startedAt,
    };
  }

  private reasonCode(error: unknown): string {
    if (!(error instanceof HttpException)) return 'internal_error';
    const body = error.getResponse();
    if (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string'
    ) {
      return body.code.slice(0, 100);
    }
    return error.name
      .replace(/Exception$/, '')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase();
  }

  private readResultPath(result: unknown, path?: string): string | null {
    if (!path || typeof result !== 'object' || result === null) return null;
    const value = this.readPath(result, path);
    const envelopeData = (result as Record<string, unknown>).data;
    const fallbackValue = value ?? this.readPath(envelopeData, path);
    return typeof fallbackValue === 'string' || typeof fallbackValue === 'number'
      ? String(fallbackValue)
      : null;
  }

  private readPath(result: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (typeof current !== 'object' || current === null) return undefined;
      return (current as Record<string, unknown>)[key];
    }, result);
  }

  private singleHeader(value: string | string[] | undefined): string | null {
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }
}
