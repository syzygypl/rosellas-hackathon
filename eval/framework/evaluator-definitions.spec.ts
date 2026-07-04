import { loadDeterministicDefinition, loadHostedDefinition, loadLlmJudgeDefinition } from './evaluator-definitions';

describe('evaluator definitions', () => {
  it('loads inspectable deterministic evaluator metadata', () => {
    const definition = loadDeterministicDefinition();
    expect(definition.id).toBe('local-deterministic');
    expect(definition.scores.map((score) => score.name)).toContain('deterministic_overall');
  });

  it('loads inspectable LLM judge metadata', () => {
    const definition = loadLlmJudgeDefinition();
    expect(definition.rubric.overall_quality).toMatch(/Compact/);
    expect(definition.statusScoreName).toBe('llm_judge_status');
  });

  it('loads hosted Langfuse evaluator definitions', () => {
    const definition = loadHostedDefinition();
    expect(definition.evaluators.map((evaluator) => evaluator.name)).toEqual([
      'rosellas.solution_quality',
      'rosellas.chat_contract',
    ]);
    expect(definition.rules.every((rule) => rule.enabled === false)).toBe(true);
  });
});
