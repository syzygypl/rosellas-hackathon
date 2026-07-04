import { normalizeApiBase, runScenarioAgainstBackend } from './backend';
import type { EvalScenario } from './types';

const scenario: EvalScenario = {
  id: 'sdg12-ewaste',
  title: 'E-waste',
  prompt: 'Prompt',
  maxAnswerWords: 100,
  requiredCriteria: [{ id: 'x', description: 'x', keywords: ['x'] }],
  positiveSignals: [{ id: 'y', description: 'y', keywords: ['y'] }],
  forbiddenPatterns: [],
};

describe('backend runner', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes API base URLs', () => {
    expect(normalizeApiBase('http://localhost:8080')).toBe('http://localhost:8080/api');
    expect(normalizeApiBase('http://localhost:8080/api/')).toBe('http://localhost:8080/api');
  });

  it('posts the chat contract and captures observations', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'ok', engine: 'pipeline', solution: { trail: [] } }),
    });
    global.fetch = fetchMock as any;

    const result = await runScenarioAgainstBackend({
      scenario,
      runName: 'test-run',
      backendUrl: 'http://localhost:9999/api',
      observationPoller: async () => ({ count: 0, names: [], toolTrail: [], traceIds: [] }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:9999/api/chat',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"sessionId":"eval-test-run-sdg12-ewaste"'),
      }),
    );
    expect(result.chat.engine).toBe('pipeline');
  });
});
