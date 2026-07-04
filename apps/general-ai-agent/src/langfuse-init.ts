import { Logger } from '@nestjs/common';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

const logger = new Logger('Langfuse');
let sdk: NodeSDK | null = null;

export function isLangfuseConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY?.trim() && process.env.LANGFUSE_SECRET_KEY?.trim());
}

export function initializeLangfuseTracing(): void {
  if (sdk || !isLangfuseConfigured()) {
    if (!sdk) {
      logger.log('Langfuse tracing disabled; LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are not both set.');
    }
    return;
  }

  process.env.LANGCHAIN_CALLBACKS_BACKGROUND ??= 'false';

  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
        environment: process.env.LANGFUSE_TRACING_ENVIRONMENT,
        release: process.env.GIT_SHA || process.env.APP_VERSION,
        exportMode: 'batched',
      }),
    ],
  });

  sdk.start();
  logger.log(`Langfuse tracing enabled (${process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'}).`);
}

export async function shutdownLangfuseTracing(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
}
