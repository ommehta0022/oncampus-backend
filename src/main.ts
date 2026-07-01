import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

function parseCorsOrigins(rawOrigins?: string): string[] {
  const origins = rawOrigins
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  if (process.env.NODE_ENV === 'production' && (origins.length === 0 || origins.includes('*'))) {
    throw new Error('CORS_ORIGINS must list exact origins in production');
  }

  return origins.length > 0 ? origins : ['http://localhost:3000', 'http://localhost:3001'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(configService.get('CORS_ORIGINS')),
    credentials: true,
  });

  // Compression
  app.use(compression());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('v1');

  const port = configService.get('PORT') || 4000;
  await app.listen(port);

  console.log(`🚀 OnCampus Backend API running on: http://localhost:${port}/v1`);
  console.log(`🔌 WebSocket Gateway: ws://localhost:${port}/realtime`);
}

bootstrap();
