import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import { initializeLangfuseTracing, shutdownLangfuseTracing } from './langfuse-init';

config();
initializeLangfuseTracing();

function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured?.length) {
    return configured;
  }

  return ['http://localhost:4200', 'http://localhost:5000'];
}

function backendPort(): number {
  const configured =
    process.env.BACKEND_PORT || (process.env.NODE_ENV === 'production' ? process.env.PORT : undefined);
  return Number(configured) || 8080;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  const port = backendPort();
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(
    `AI Agent backend listening on port ${port} (MCP: ${process.env.MCP_URL || 'http://localhost:8123/mcp'})`,
  );
}

bootstrap();

process.once('SIGTERM', () => {
  shutdownLangfuseTracing().finally(() => process.exit(0));
});

process.once('SIGINT', () => {
  shutdownLangfuseTracing().finally(() => process.exit(0));
});
