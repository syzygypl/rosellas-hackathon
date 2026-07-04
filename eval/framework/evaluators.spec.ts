import { deterministicScores, evaluateDeterministic } from './evaluators';
import type { EvalScenario, ScenarioOutput } from './types';

const scenario: EvalScenario = {
  id: 'test',
  title: 'Test',
  prompt: 'Prompt',
  maxAnswerWords: 80,
  requiredCriteria: [
    { id: 'safe', description: 'safe', keywords: ['safe'] },
    { id: 'modular', description: 'modular', keywords: ['modular'] },
  ],
  positiveSignals: [{ id: 'monitoring', description: 'monitoring', keywords: ['monitoring'] }],
  forbiddenPatterns: [{ id: 'bad', description: 'bad', patterns: ['landfill'] }],
};

const output: ScenarioOutput = {
  scenarioId: 'test',
  sessionId: 'eval-test',
  startedAt: new Date(0).toISOString(),
  endedAt: new Date(1).toISOString(),
  latencyMs: 1,
  chat: {
    answer: 'Use a safe modular system with monitoring.',
    engine: 'agent',
    solution: {
      title: 'Safe modular recovery',
      trail: ['search_parameter({})', 'browse_contradiction_matrix({})'],
    },
  },
  observations: {
    count: 2,
    names: ['search_parameter', 'browse_contradiction_matrix'],
    toolTrail: ['search_parameter:TOOL'],
    traceIds: ['trace'],
  },
};

describe('deterministic evaluators', () => {
  it('scores a complete answer above threshold', () => {
    const result = evaluateDeterministic(scenario, output);
    expect(result.overall).toBeGreaterThanOrEqual(0.75);
    expect(result.forbiddenAbsent).toBe(true);
    expect(result.coverage).toBe(1);
  });

  it('penalizes forbidden patterns', () => {
    const result = evaluateDeterministic(scenario, {
      ...output,
      chat: { ...output.chat, answer: `${output.chat.answer} Send the rest to landfill.` },
    });
    expect(result.forbiddenAbsent).toBe(false);
    expect(result.forbiddenMatches).toEqual(['bad']);
  });

  it('emits Langfuse-compatible scores', () => {
    const scores = deterministicScores(scenario, output);
    expect(scores.map((score) => score.name)).toContain('deterministic_overall');
    expect(scores.find((score) => score.name === 'answer_brief')?.dataType).toBe('BOOLEAN');
  });
});
