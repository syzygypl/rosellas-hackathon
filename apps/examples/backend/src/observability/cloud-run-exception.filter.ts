import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { reportErrorToCloudRun } from './cloud-run-logger';

@Catch()
export class CloudRunExceptionFilter implements ExceptionFilter {
  constructor(private readonly serviceName: string) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status = statusCode(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      reportErrorToCloudRun(exception, request, status, this.serviceName);
    }

    if (response.headersSent) {
      return;
    }

    response.status(status).json(responseBody(exception, status, request));
  }
}

function statusCode(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function responseBody(
  exception: unknown,
  status: number,
  request: Request,
): Record<string, unknown> {
  const path = request.originalUrl || request.url;

  if (exception instanceof HttpException) {
    const payload = exception.getResponse();
    const body =
      typeof payload === 'string'
        ? { message: payload }
        : isRecord(payload)
          ? { ...payload }
          : { message: 'Request failed' };

    return {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path,
      ...body,
    };
  }

  return {
    statusCode: status,
    timestamp: new Date().toISOString(),
    path,
    message: 'Internal server error',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
