import { randomUUID } from 'crypto';
import { RequestMethod } from '@nestjs/common';
import { Params } from 'nestjs-pino';

export function createLoggerConfig(environment: string): Params {
  const isDevelopment = environment === 'development';

  return {
    // Nest 11/path-to-regexp requires a named wildcard; nestjs-pino's legacy
    // default `*` otherwise emits LegacyRouteConverter warnings at startup.
    forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: isDevelopment ? 'debug' : 'info',
      genReqId: (request, response) => {
        const incoming = request.headers['x-request-id'];
        const requestId =
          typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers.set-cookie',
          'password',
          '*.password',
          'accessToken',
          '*.accessToken',
          'refreshToken',
          '*.refreshToken',
        ],
        censor: '[REDACTED]',
      },
      customProps: () => ({ service: 'meago-server', environment }),
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:HH:MM:ss',
              messageFormat: '{if context}[{context}] {end}{msg}',
              ignore: 'pid,hostname,context,service,environment',
            },
          }
        : undefined,
    },
  };
}
