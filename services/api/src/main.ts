import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { validateProductionEnvironment } from './common/config/production-env';

async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const corsOrigins = (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3002')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`YD Play API v1.0.0-rc1 listening on :${port}/v1`);
}

bootstrap();
