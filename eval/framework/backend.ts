import type { ChatRequest, ChatResult, EvalScenario, ObservationSummary, ScenarioOutput } from './types';

export const DEFAULT_BACKEND_URL = 'http://localhost:8080/api';

export async function runScenarioAgainstBackend(params: {
  scenario: EvalScenario;
  runName: string;
  backendUrl?: string;
  observationPoller?: (sessionId: string, startedAt: Date, endedAt: Date) => Promise<ObservationSummary>;
}): Promise<ScenarioOutput> {
  const baseUrl = normalizeApiBase(params.backendUrl || process.env.EVAL_BACKEND_URL || DEFAULT_BACKEND_URL);
  const sessionId = `eval-${slug(params.runName)}-${params.scenario.id}`;
  const started = new Date();
  const startMs = Date.now();

  const body: ChatRequest = {
    sessionId,
    messages: [{ role: 'user', content: params.scenario.prompt }],
  };

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Backend ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  const chat = normalizeChatResult(await response.json());
  const ended = new Date();
  const observations = params.observationPoller
    ? await params.observationPoller(sessionId, started, ended)
    : emptyObservations();

  return {
    scenarioId: params.scenario.id,
    sessionId,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    chat,
    observations,
    latencyMs: Date.now() - startMs,
  };
}

export function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function emptyObservations(error?: string): ObservationSummary {
  return {
    count: 0,
    names: [],
    toolTrail: [],
    traceIds: [],
    ...(error ? { error } : {}),
  };
}

function normalizeChatResult(value: unknown): ChatResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Backend returned a non-object chat response');
  }
  const result = value as ChatResult;
  if (typeof result.answer !== 'string') {
    throw new Error('Backend chat response is missing string field: answer');
  }
  return {
    answer: result.answer,
    engine: result.engine,
    solution: result.solution ?? null,
    warning: result.warning,
    suggestions: result.suggestions,
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
