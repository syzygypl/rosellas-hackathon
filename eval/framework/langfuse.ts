import { LangfuseClient } from '@langfuse/client';
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { emptyObservations } from './backend';
import type { ObservationSummary } from './types';

let sdk: NodeSDK | null = null;

export function isLangfuseConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY?.trim() && process.env.LANGFUSE_SECRET_KEY?.trim());
}

export function createLangfuseClient(): LangfuseClient {
  return new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  });
}

export function startLangfuseOtel(): void {
  if (sdk || !isLangfuseConfigured()) return;
  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
        environment: 'sdk-experiment',
        exportMode: 'batched',
      }),
    ],
  });
  sdk.start();
}

export async function stopLangfuseOtel(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
}

export async function withEvalScenarioObservation<T>(params: {
  scenarioId: string;
  sessionId: string;
  input: unknown;
  runName: string;
  fn: () => Promise<T>;
}): Promise<T> {
  return startActiveObservation(
    'eval.scenario',
    async (span) =>
      propagateAttributes(
        {
          sessionId: params.sessionId,
          traceName: 'rosellas-eval',
          tags: ['rosellas-eval', params.scenarioId],
          metadata: {
            scenarioId: params.scenarioId,
            runName: params.runName.slice(0, 200),
          },
        },
        async () => {
          try {
            const output = await params.fn();
            span.update({
              input: params.input,
              output,
              metadata: { scenarioId: params.scenarioId, runName: params.runName },
            });
            return output;
          } catch (err) {
            span.update({
              input: params.input,
              level: 'ERROR',
              statusMessage: err instanceof Error ? err.message : String(err),
              metadata: { scenarioId: params.scenarioId, runName: params.runName },
            });
            throw err;
          }
        },
      ),
    { asType: 'span' },
  );
}

export async function pollLangfuseObservations(
  sessionId: string,
  startedAt: Date,
  endedAt: Date,
): Promise<ObservationSummary> {
  if (!isLangfuseConfigured()) return emptyObservations('Langfuse credentials not configured.');

  const from = new Date(startedAt.getTime() - 60_000).toISOString();
  const to = new Date(Math.max(Date.now(), endedAt.getTime()) + 120_000).toISOString();
  let lastError: string | undefined;

  let bestRows: any[] = [];
  let stableReads = 0;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) await delay(1000 * attempt);
    try {
      const observations = await fetchObservationRows(sessionId, from, to);
      if (observations.length > bestRows.length) {
        bestRows = observations;
        stableReads = 0;
      } else if (observations.length === bestRows.length && observations.length > 0) {
        stableReads += 1;
      }

      const summary = summarizeObservations(bestRows);
      if (summary.toolTrail.length || stableReads >= 2 || attempt === 5) {
        return summary;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return emptyObservations(lastError || 'No Langfuse observations found for session window.');
}

async function fetchObservationRows(sessionId: string, from: string, to: string): Promise<any[]> {
  const baseUrl = (process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com').replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/api/public/v2/observations`);
  url.searchParams.set('fields', 'core,basic,metadata,trace_context,usage');
  url.searchParams.set('fromStartTime', from);
  url.searchParams.set('toStartTime', to);
  url.searchParams.set('limit', '1000');
  url.searchParams.set(
    'filter',
    JSON.stringify([{ type: 'string', column: 'sessionId', operator: '=', value: sessionId }]),
  );

  const response = await fetch(url, {
    headers: {
      authorization: `Basic ${Buffer.from(
        `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`,
      ).toString('base64')}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Langfuse observations ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

function summarizeObservations(rows: any[]): ObservationSummary {
  const names = unique(rows.map((row) => String(row.name || '')).filter(Boolean));
  const traceIds = unique(rows.map((row) => String(row.traceId || '')).filter(Boolean));
  const toolTrail = rows
    .filter((row) => isToolish(row))
    .map((row) => `${row.name}${row.type ? `:${row.type}` : ''}`);
  const totalCost = sum(rows.map((row) => Number(row.totalCost ?? row.costDetails?.total ?? 0)));
  const totalTokens = sum(rows.map((row) => Number(row.totalUsage ?? row.usageDetails?.total ?? 0)));

  return {
    count: rows.length,
    names,
    toolTrail,
    traceIds,
    ...(totalCost > 0 ? { totalCost } : {}),
    ...(totalTokens > 0 ? { totalTokens } : {}),
  };
}

function isToolish(row: any): boolean {
  const name = String(row.name || '').toLowerCase();
  const type = String(row.type || '').toLowerCase();
  if (type === 'tool') return true;

  const metadata = row.metadata || {};
  const metadataText = [
    metadata.tool,
    metadata.langgraph_node,
    ...(Array.isArray(metadata.tags) ? metadata.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /tool|triz|scamper|matrix|search_parameter|browse_contradiction/.test(
    `${name} ${metadataText}`,
  );
}

function sum(values: number[]): number {
  return values.filter(Number.isFinite).reduce((acc, value) => acc + value, 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
