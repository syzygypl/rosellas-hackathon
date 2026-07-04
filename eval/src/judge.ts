import type { Evaluator } from '@langfuse/client';
import { allText } from './evaluators';
import type { EvalScenario, EvalScore, ScenarioOutput } from './types';

interface JudgeResult {
  problem_fit: number;
  triz_grounding: number;
  feasibility_safety: number;
  overall_quality: number;
  reasoning: string;
}

export function createLlmJudgeEvaluator(
  scenarioById: Map<string, EvalScenario>,
  options: { requireLlmJudge: boolean; skipLlmJudge: boolean },
): Evaluator<string, unknown, { scenarioId: string }> {
  return async ({ output, metadata }) => {
    const scenario = scenarioById.get(metadata?.scenarioId || '');
    if (!scenario) throw new Error(`Missing scenario for LLM judge: ${metadata?.scenarioId}`);
    return judgeScenario(scenario, output as ScenarioOutput, options);
  };
}

export async function judgeScenario(
  scenario: EvalScenario,
  output: ScenarioOutput,
  options: { requireLlmJudge: boolean; skipLlmJudge: boolean },
): Promise<EvalScore[]> {
  if (options.skipLlmJudge) return skipped('disabled by --skip-llm-judge');
  if (!process.env.OPENAI_API_KEY?.trim()) {
    if (options.requireLlmJudge) throw new Error('OPENAI_API_KEY is required by --require-llm-judge.');
    return skipped('OPENAI_API_KEY not set');
  }

  const model = process.env.EVAL_LLM_JUDGE_MODEL || process.env.LANGFUSE_EVAL_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a strict evaluator for a TRIZ sustainability agent. Return only JSON with numeric fields from 0 to 1 and short reasoning.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            scenario: {
              id: scenario.id,
              title: scenario.title,
              prompt: scenario.prompt,
              requiredCriteria: scenario.requiredCriteria,
              forbiddenPatterns: scenario.forbiddenPatterns,
            },
            answer: output.chat.answer,
            solutionText: allText(output),
            engine: output.chat.engine,
            toolTrail: output.chat.solution?.trail || output.observations.toolTrail,
            rubric: {
              problem_fit: 'Addresses the exact contradiction and constraints.',
              triz_grounding: 'Grounded in TRIZ principles, parameters, contradiction matrix, or analogous inventive principles.',
              feasibility_safety: 'Operationally plausible and avoids unsafe or forbidden recommendations.',
              overall_quality: 'Compact, useful solution quality.',
            },
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI judge ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = parseJudgeResult(content);

  return [
    score('llm_problem_fit', parsed.problem_fit, parsed.reasoning),
    score('llm_triz_grounding', parsed.triz_grounding),
    score('llm_feasibility_safety', parsed.feasibility_safety),
    score('llm_overall_quality', parsed.overall_quality),
    { name: 'llm_judge_status', value: 'scored', dataType: 'CATEGORICAL', comment: model },
  ];
}

function parseJudgeResult(content: unknown): JudgeResult {
  if (typeof content !== 'string') throw new Error('OpenAI judge response missing content');
  const parsed = JSON.parse(content) as Partial<JudgeResult>;
  return {
    problem_fit: clamp(parsed.problem_fit),
    triz_grounding: clamp(parsed.triz_grounding),
    feasibility_safety: clamp(parsed.feasibility_safety),
    overall_quality: clamp(parsed.overall_quality),
    reasoning: String(parsed.reasoning || '').slice(0, 500),
  };
}

function skipped(reason: string): EvalScore[] {
  return [{ name: 'llm_judge_status', value: 'skipped', dataType: 'CATEGORICAL', comment: reason }];
}

function score(name: string, value: number, comment?: string): EvalScore {
  return { name, value, dataType: 'NUMERIC', ...(comment ? { comment } : {}) };
}

function clamp(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, Math.round(numeric * 1000) / 1000));
}
