import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import { initializeLangfuseTracing, shutdownLangfuseTracing } from './langfuse-init';
import { CloudRunExceptionFilter } from './observability/cloud-run-exception.filter';
import { CloudRunLogger, cloudRunRequestContextMiddleware } from './observability/cloud-run-logger';

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
  const serviceName = process.env.K_SERVICE || 'general-ai-agent';
  const logger = new CloudRunLogger(serviceName);
  Logger.overrideLogger(logger);

  const app = await NestFactory.create(AppModule, { logger });
  app.useLogger(logger);
  app.use(cloudRunRequestContextMiddleware());
  app.useGlobalFilters(new CloudRunExceptionFilter(serviceName));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  const port = backendPort();
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(
    `AI Agent backend listening on port ${port} (TRIZ MCP: ${process.env.MCP_URL || 'http://localhost:8123/mcp'}, SCAMPER MCP: ${process.env.SCAMPER_MCP_URL || 'http://localhost:8124/mcp'})`,
  );
}

bootstrap();

process.once('SIGTERM', () => {
  shutdownLangfuseTracing().finally(() => process.exit(0));
});

process.once('SIGINT', () => {
  shutdownLangfuseTracing().finally(() => process.exit(0));
});
