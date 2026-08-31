import { randomUUID } from 'crypto';
import { Params } from 'nestjs-pino';

export function createLoggerConfig(environment: string): Params {
  const isDevelopment = environment === 'development';

  return {
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
            options: { colorize: true, singleLine: true, translateTime: 'SYS:standard' },
          }
        : undefined,
    },
  };
}
