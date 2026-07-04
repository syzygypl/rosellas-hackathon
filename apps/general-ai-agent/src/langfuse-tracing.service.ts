import { Injectable } from '@nestjs/common';
import { CallbackHandler } from '@langfuse/langchain';
import {
  getActiveTraceId,
  propagateAttributes,
  startActiveObservation,
  type LangfuseObservationType,
  type LangfuseSpan,
} from '@langfuse/tracing';
import { isLangfuseConfigured } from './langfuse-init';

export interface TraceContext {
  traceId?: string;
}

interface TraceOptions {
  input?: unknown;
  metadata?: Record<string, unknown>;
  output?: unknown;
  tags?: string[];
  type?: LangfuseObservationType;
}

@Injectable()
export class LangfuseTracingService {
  private readonly version = process.env.APP_VERSION || 'local';

  isEnabled(): boolean {
    return isLangfuseConfigured();
  }

  langchainHandler(tags: string[] = [], metadata: Record<string, unknown> = {}): CallbackHandler | undefined {
    if (!this.isEnabled()) return undefined;
    return new CallbackHandler({
      tags: this.tags(...tags),
      version: this.version,
      traceMetadata: {
        service: 'general-ai-agent',
        ...metadata,
      },
    });
  }

  langchainConfig(runName: string, tags: string[] = [], metadata: Record<string, unknown> = {}) {
    const handler = this.langchainHandler(tags, metadata);
    return {
      runName,
      tags: this.tags(...tags),
      metadata: {
        service: 'general-ai-agent',
        version: this.version,
        ...metadata,
      },
      callbacks: handler ? [handler] : undefined,
    };
  }

  async trace<T>(
    name: string,
    options: TraceOptions,
    fn: (context: TraceContext) => Promise<T>,
  ): Promise<T> {
    if (!this.isEnabled()) {
      return fn({});
    }

    const hasParentTrace = Boolean(getActiveTraceId());
    return startActiveObservation(
      name,
      async (observation: LangfuseSpan) =>
        propagateAttributes(
          {
            traceName: hasParentTrace ? undefined : name,
            tags: this.tags(...(options.tags ?? [])),
            version: this.version,
            metadata: this.stringMetadata(options.metadata),
          },
          async () => {
            observation.update({
              input: options.input,
              metadata: {
                service: 'general-ai-agent',
                ...options.metadata,
              },
              version: this.version,
            });

            try {
              const result = await fn({ traceId: observation.traceId });
              observation.update({ output: options.output ?? result });
              return result;
            } catch (err) {
              observation.update({
                level: 'ERROR',
                statusMessage: err instanceof Error ? err.message : String(err),
                output: {
                  error: err instanceof Error ? err.message : String(err),
                },
              });
              throw err;
            }
          },
        ),
      { asType: (options.type ?? 'span') as 'span' },
    );
  }

  private tags(...tags: string[]): string[] {
    return ['rosellas', 'general-ai-agent', ...tags].filter(Boolean);
  }

  private stringMetadata(metadata: Record<string, unknown> = {}): Record<string, string> {
    const result: Record<string, string> = {
      service: 'general-ai-agent',
    };
    for (const [key, value] of Object.entries(metadata)) {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      if (text) result[key] = text.slice(0, 200);
    }
    return result;
  }
}
