import type { LoggerService } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface RequestLoggingContext {
  requestId: string;
  trace?: string;
  spanId?: string;
  traceSampled?: boolean;
}

const ERROR_REPORTING_TYPE =
  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';

const requestContextStorage = new AsyncLocalStorage<RequestLoggingContext>();

const severityRanks: Record<Severity, number> = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50,
};

export function cloudRunRequestContextMiddleware() {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const context = parseCloudTraceContext(request.header('x-cloud-trace-context'));
    requestContextStorage.run(
      {
        requestId: request.header('x-request-id') || randomUUID(),
        ...context,
      },
      () => next(),
    );
  };
}

export class CloudRunLogger implements LoggerService {
  private readonly minSeverity = severityRank(process.env.LOG_LEVEL || 'INFO');

  constructor(private readonly serviceName: string) {}

  log(message: unknown, context?: string): void {
    this.write('INFO', message, undefined, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('ERROR', message, stack, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('WARNING', message, undefined, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('DEBUG', message, undefined, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('DEBUG', message, undefined, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('CRITICAL', message, undefined, context);
  }

  private write(severity: Severity, message: unknown, stack?: string, context?: string): void {
    if (severityRanks[severity] < this.minSeverity) {
      return;
    }

    const text = normalizeMessage(message);
    const entry = baseLogEntry(this.serviceName, severity, stack ? `${text}\n${stack}` : text);
    if (context) {
      entry.context = context;
    }
    if (message instanceof Error && message.stack && !stack) {
      entry.message = `${message.message}\n${message.stack}`;
    }

    writeStructuredLog(severity, entry);
  }
}

export function reportErrorToCloudRun(
  exception: unknown,
  request: Request,
  status: number,
  serviceName: string,
): void {
  const message = errorMessageWithStack(exception);
  const entry = baseLogEntry(serviceName, 'ERROR', message);
  entry['@type'] = ERROR_REPORTING_TYPE;
  entry.context = 'UnhandledHttpException';
  entry.httpRequest = {
    requestMethod: request.method,
    requestUrl: requestUrl(request),
    status,
    userAgent: request.header('user-agent'),
    remoteIp: remoteIp(request),
    referer: request.header('referer'),
    protocol: request.protocol,
  };

  writeStructuredLog('ERROR', entry);
}

function baseLogEntry(
  serviceName: string,
  severity: Severity,
  message: string,
): Record<string, unknown> {
  const context = requestContextStorage.getStore();
  const entry: Record<string, unknown> = {
    severity,
    message,
    service: serviceName,
    serviceContext: {
      service: serviceName,
      version: process.env.GIT_SHA || process.env.K_REVISION || process.env.APP_VERSION || 'local',
    },
  };

  if (context?.requestId) {
    entry.requestId = context.requestId;
  }
  if (context?.trace) {
    entry['logging.googleapis.com/trace'] = context.trace;
  }
  if (context?.spanId) {
    entry['logging.googleapis.com/spanId'] = context.spanId;
  }
  if (context?.traceSampled !== undefined) {
    entry['logging.googleapis.com/trace_sampled'] = context.traceSampled;
  }

  return entry;
}

function parseCloudTraceContext(
  header: string | undefined,
): Pick<RequestLoggingContext, 'trace' | 'spanId' | 'traceSampled'> {
  if (!header) {
    return {};
  }

  const match = header.match(/^([0-9a-fA-F]{32})(?:\/(\d+))?(?:;o=(\d))?/);
  if (!match) {
    return {};
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  return {
    trace: projectId ? `projects/${projectId}/traces/${match[1]}` : undefined,
    spanId: match[2],
    traceSampled: match[3] === '1',
  };
}

function normalizeMessage(message: unknown): string {
  if (message instanceof Error) {
    return message.message;
  }
  if (typeof message === 'string') {
    return message;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function errorMessageWithStack(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.stack ? `${exception.message}\n${exception.stack}` : exception.message;
  }
  return normalizeMessage(exception);
}

function requestUrl(request: Request): string {
  const host = request.header('host');
  const path = request.originalUrl || request.url;
  if (!host) {
    return path;
  }

  const forwardedProtocol = request.header('x-forwarded-proto');
  const protocol = forwardedProtocol?.split(',')[0]?.trim() || request.protocol || 'https';
  return `${protocol}://${host}${path}`;
}

function remoteIp(request: Request): string | undefined {
  const forwardedFor = request.header('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || request.ip;
}

function severityRank(value: string): number {
  const normalized = value.toUpperCase();
  if (normalized === 'WARN') {
    return severityRanks.WARNING;
  }
  return severityRanks[normalized as Severity] ?? severityRanks.INFO;
}

function writeStructuredLog(severity: Severity, entry: Record<string, unknown>): void {
  const line = `${JSON.stringify(entry)}\n`;
  if (severityRanks[severity] >= severityRanks.WARNING) {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}
