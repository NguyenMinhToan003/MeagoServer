import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { configureHttpApplication } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const conf = configureHttpApplication(app);

  await app.listen(conf.port, '0.0.0.0');
  app.get(Logger).log(`Meago API listening on port ${conf.port}`, 'Bootstrap');
}
bootstrap().catch((err: unknown) => {
  console.error('Failed to start Meago API', err);
  process.exit(1);
});
