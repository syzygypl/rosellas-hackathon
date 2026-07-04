import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module';

config();

function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured?.length) {
    return configured;
  }

  return ['http://localhost:4200', 'http://localhost:5000'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  const port = Number(process.env.PORT) || 8080;
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(
    `AI Agent backend listening on port ${port} (MCP: ${process.env.MCP_URL || 'http://localhost:8123/mcp'})`,
  );
}
bootstrap();
