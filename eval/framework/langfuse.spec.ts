import { pollLangfuseObservations } from './langfuse';

describe('Langfuse polling', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = {
      ...originalEnv,
      LANGFUSE_PUBLIC_KEY: 'pk-test',
      LANGFUSE_SECRET_KEY: 'sk-test',
      LANGFUSE_BASE_URL: 'https://langfuse.test',
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.useRealTimers();
  });

  it('waits for nested tool observations instead of returning the first partial ingest', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ name: 'ChatOpenAI', type: 'GENERATION', traceId: 'trace-1' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              name: 'ChatOpenAI',
              type: 'GENERATION',
              traceId: 'trace-1',
              metadata: { toolCallCount: 1 },
            },
            { name: 'search_parameter', type: 'TOOL', traceId: 'trace-1' },
          ],
        }),
      });
    global.fetch = fetchMock as any;

    const resultPromise = pollLangfuseObservations('session-1', new Date(0), new Date(1));
    await jest.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(2);
    expect(result.toolTrail).toEqual(['search_parameter:TOOL']);
    expect(result.traceIds).toEqual(['trace-1']);
  });
});
