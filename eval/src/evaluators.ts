import type { Evaluator, RunEvaluator } from '@langfuse/client';
import type { DeterministicBreakdown, EvalScenario, EvalScore, ScenarioOutput } from './types';

export function evaluateDeterministic(scenario: EvalScenario, output: ScenarioOutput): DeterministicBreakdown {
  const text = allText(output).toLowerCase();
  const trailText = [
    ...(output.chat.solution?.trail || []),
    ...output.observations.toolTrail,
    ...output.observations.names,
  ]
    .join('\n')
    .toLowerCase();

  const matchedCriteria = scenario.requiredCriteria
    .filter((criterion) => criterion.keywords.some((keyword) => text.includes(keyword.toLowerCase())))
    .map((criterion) => criterion.id);
  const matchedPositiveSignals = scenario.positiveSignals.filter((signal) =>
    signal.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
  );
  const forbiddenMatches = scenario.forbiddenPatterns
    .filter((patternGroup) => patternGroup.patterns.some((pattern) => new RegExp(pattern, 'i').test(text)))
    .map((patternGroup) => patternGroup.id);

  const coverage = matchedCriteria.length / scenario.requiredCriteria.length;
  const positiveSignalCoverage = scenario.positiveSignals.length
    ? matchedPositiveSignals.length / scenario.positiveSignals.length
    : 1;
  const answerBrief = countWords(output.chat.answer) <= scenario.maxAnswerWords;
  const solutionPresent = Boolean(output.chat.solution);
  const toolTrailPresent = /search_parameter|browse_contradiction_matrix|contradiction matrix|triz matrix|triz/.test(
    trailText,
  );
  const enginePresent = Boolean(output.chat.engine);
  const forbiddenAbsent = forbiddenMatches.length === 0;

  const overall =
    0.15 * bool(enginePresent) +
    0.15 * bool(solutionPresent) +
    0.15 * bool(toolTrailPresent) +
    0.1 * bool(answerBrief) +
    0.2 * bool(forbiddenAbsent) +
    0.2 * coverage +
    0.05 * positiveSignalCoverage;

  return {
    enginePresent,
    solutionPresent,
    toolTrailPresent,
    answerBrief,
    forbiddenAbsent,
    coverage,
    positiveSignalCoverage,
    matchedCriteria,
    forbiddenMatches,
    overall: round(overall),
  };
}

export function deterministicScores(scenario: EvalScenario, output: ScenarioOutput): EvalScore[] {
  const b = evaluateDeterministic(scenario, output);
  return [
    boolScore('agent_engine_present', b.enginePresent, output.chat.engine || 'missing'),
    boolScore('solution_card_present', b.solutionPresent),
    boolScore('triz_tool_trail_present', b.toolTrailPresent, output.observations.error || undefined),
    boolScore('answer_brief', b.answerBrief, `${countWords(output.chat.answer)} words; limit ${scenario.maxAnswerWords}`),
    boolScore(
      'forbidden_solution_patterns_absent',
      b.forbiddenAbsent,
      b.forbiddenMatches.length ? `Matched: ${b.forbiddenMatches.join(', ')}` : undefined,
    ),
    {
      name: 'domain_criteria_coverage',
      value: round(b.coverage),
      dataType: 'NUMERIC',
      comment: `Matched ${b.matchedCriteria.length}/${scenario.requiredCriteria.length}: ${b.matchedCriteria.join(', ') || 'none'}`,
    },
    {
      name: 'positive_signal_coverage',
      value: round(b.positiveSignalCoverage),
      dataType: 'NUMERIC',
    },
    {
      name: 'deterministic_overall',
      value: b.overall,
      dataType: 'NUMERIC',
      comment: b.overall >= 0.75 ? 'pass' : 'below threshold',
    },
  ];
}

export function createDeterministicEvaluator(
  scenarioById: Map<string, EvalScenario>,
): Evaluator<string, unknown, { scenarioId: string }> {
  return async ({ output, metadata }) => {
    const scenario = scenarioById.get(metadata?.scenarioId || '');
    if (!scenario) throw new Error(`Missing scenario for evaluator: ${metadata?.scenarioId}`);
    return deterministicScores(scenario, output as ScenarioOutput);
  };
}

export const aggregateEvaluator: RunEvaluator<string, unknown, { scenarioId: string }> = async ({ itemResults }) => {
  const values = itemResults
    .map((result) => result.evaluations.find((score) => score.name === 'deterministic_overall')?.value)
    .filter((value): value is number => typeof value === 'number');
  const average = values.length ? round(values.reduce((acc, value) => acc + value, 0) / values.length) : 0;
  return [
    {
      name: 'run_average_deterministic',
      value: average,
      dataType: 'NUMERIC',
      comment: average >= 0.75 ? 'pass' : 'fail',
    },
    {
      name: 'run_pass',
      value: average >= 0.75 ? 1 : 0,
      dataType: 'BOOLEAN',
      comment: 'Threshold: average deterministic score >= 0.75',
    },
  ];
};

export function passedRun(scores: EvalScore[]): boolean {
  const deterministic = scores.find((score) => score.name === 'deterministic_overall')?.value;
  return typeof deterministic === 'number' && deterministic >= 0.75;
}

export function allText(output: ScenarioOutput): string {
  const solution = output.chat.solution;
  return [
    output.chat.answer,
    solution?.title,
    solution?.summary,
    ...(solution?.directions || []).flatMap((direction) => [direction.principle, direction.idea, direction.why]),
    ...(solution?.nextSteps || []),
    solution?.contradiction,
    solution?.principles,
    solution?.related,
    solution?.report,
  ]
    .filter(Boolean)
    .join('\n');
}

export function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function boolScore(name: string, value: boolean, comment?: string): EvalScore {
  return {
    name,
    value: value ? 1 : 0,
    dataType: 'BOOLEAN',
    ...(comment ? { comment } : {}),
  };
}

function bool(value: boolean): number {
  return value ? 1 : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
