import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { AppModule } from './app.module';

config(); // load .env if present

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `Inventive Solver running: http://localhost:${port}  (MCP: ${process.env.MCP_URL || 'http://localhost:8123/mcp'})`,
  );
}
bootstrap();
