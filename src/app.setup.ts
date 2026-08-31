import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { APP_CONFIG, AppConfig } from './configs/app.config';

/** Shared by the real bootstrap and E2E tests so transport behavior cannot drift. */
export function configureHttpApplication(app: NestExpressApplication): AppConfig {
  const config = app.get(ConfigService).get<AppConfig>(APP_CONFIG)!;

  app.set('trust proxy', config.trustProxyHops);
  app.setGlobalPrefix(config.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  if (config.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Meago API')
      .setDescription('Meago - audio/story sharing platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('swagger', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  return config;
}
