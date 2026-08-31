import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './configs/app.config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const conf = app.get(ConfigService).get<AppConfig>(APP_CONFIG)!;

  app.set('trust proxy', 1);
  app.setGlobalPrefix(conf.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({ origin: conf.corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Meago API')
    .setDescription('Meago - audio/story sharing platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('swagger', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(conf.port, '0.0.0.0');
  app.get(Logger).log(`Meago API listening on port ${conf.port}`, 'Bootstrap');
}
bootstrap().catch((err: unknown) => {
  console.error('Failed to start Meago API', err);
  process.exit(1);
});
