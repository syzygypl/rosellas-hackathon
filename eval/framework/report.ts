import type { ExperimentResult } from '@langfuse/client';
import { passedRun } from './evaluators';
import type { EvalScenario, ScenarioOutput } from './types';

export function formatScenarioTable(
  result: ExperimentResult<string, unknown, { scenarioId: string }>,
  scenarios: EvalScenario[],
): string {
  const titleById = new Map(scenarios.map((scenario) => [scenario.id, scenario.title]));
  const rows = result.itemResults.map((item) => {
    const scenarioId = item.item.metadata?.scenarioId || 'unknown';
    const output = item.output as ScenarioOutput;
    const deterministic = item.evaluations.find((score) => score.name === 'deterministic_overall')?.value;
    const llm = item.evaluations.find((score) => score.name === 'llm_overall_quality')?.value;
    const pass = passedRun(item.evaluations);
    return [
      scenarioId,
      pass ? 'PASS' : 'FAIL',
      formatNumber(deterministic),
      formatNumber(llm),
      output.chat.engine || 'missing',
      output.chat.solution ? 'yes' : 'no',
      String(output.observations.toolTrail.length || output.chat.solution?.trail?.length || 0),
      titleById.get(scenarioId) || '',
    ];
  });

  return table([
    ['scenario', 'result', 'det', 'llm', 'engine', 'solution', 'tools', 'title'],
    ...rows,
  ]);
}

export function shouldFail(result: ExperimentResult<string, unknown, { scenarioId: string }>): boolean {
  const runPass = result.runEvaluations.find((score) => score.name === 'run_pass')?.value;
  if (runPass === 0) return true;
  return result.itemResults.some((item) => !passedRun(item.evaluations));
}

function formatNumber(value: unknown): string {
  return typeof value === 'number' ? value.toFixed(3) : '-';
}

function table(rows: string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows
    .map((row, index) => {
      const line = row.map((cell, column) => cell.padEnd(widths[column])).join('  ');
      return index === 0 ? `${line}\n${widths.map((width) => '-'.repeat(width)).join('  ')}` : line;
    })
    .join('\n');
}
