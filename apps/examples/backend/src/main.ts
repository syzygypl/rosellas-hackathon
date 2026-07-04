import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CloudRunExceptionFilter } from './observability/cloud-run-exception.filter';
import { CloudRunLogger, cloudRunRequestContextMiddleware } from './observability/cloud-run-logger';

function appVersion(): string {
  return process.env.APP_VERSION ?? 'local';
}

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
  const serviceName = process.env.K_SERVICE || 'crud-backend';
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rosellas Example Backend API')
    .setDescription('Example Items CRUD API backed by Firestore')
    .setVersion(appVersion())
    .addTag('health', 'Runtime health checks')
    .addTag('version', 'Application version metadata')
    .addTag('items', 'Firestore-backed CRUD operations')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Backend listening on port ${port}`);
}

bootstrap();
