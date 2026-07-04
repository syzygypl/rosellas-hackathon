#!/usr/bin/env node
import { LangfuseClient } from '@langfuse/client';
import { runScenarioAgainstBackend } from './backend';
import { parseArgs, usage } from './args';
import { aggregateEvaluator, createDeterministicEvaluator } from './evaluators';
import { createLlmJudgeEvaluator } from './judge';
import {
  createLangfuseClient,
  isLangfuseConfigured,
  pollLangfuseObservations,
  startLangfuseOtel,
  stopLangfuseOtel,
  withEvalScenarioObservation,
} from './langfuse';
import { pushHostedDefinitions } from './push';
import { formatScenarioTable, shouldFail } from './report';
import { loadScenarios, selectScenarios } from './scenarios';
import type { EvalScenario, ScenarioOutput } from './types';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help') {
    console.log(usage());
    return;
  }

  if (args.command === 'push') {
    await pushHostedDefinitions({ dryRun: args.dryRun, enable: args.enable });
    return;
  }

  const allScenarios = loadScenarios();
  if (args.command === 'list') {
    for (const scenario of allScenarios) {
      console.log(`${scenario.id}\t${scenario.title}`);
    }
    return;
  }

  const scenarios = selectScenarios(allScenarios, args.scenarios);
  await runEval(scenarios, args);
}

async function runEval(scenarios: EvalScenario[], args: ReturnType<typeof parseArgs>): Promise<void> {
  const runName = args.runName || `rosellas-eval-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const data = scenarios.map((scenario) => ({
    input: scenario.prompt,
    expectedOutput: scenario.requiredCriteria.map((criterion) => criterion.description).join('\n'),
    metadata: { scenarioId: scenario.id },
  }));
  const client = isLangfuseConfigured() ? createLangfuseClient() : new OfflineExperimentClient();

  startLangfuseOtel();
  try {
    const result = await client.experiment.run<string, unknown, { scenarioId: string }>({
      name: 'Rosellas TRIZ Agent Evaluation',
      runName,
      description: 'Local SDG scenarios against POST /api/chat.',
      data,
      maxConcurrency: args.maxConcurrency,
      metadata: {
        suite: 'rosellas-eval',
        backendUrl: args.backendUrl || process.env.EVAL_BACKEND_URL || 'http://localhost:8080/api',
      },
      task: async (item) => {
        const scenario = scenarioById.get(item.metadata?.scenarioId || '');
        if (!scenario) throw new Error(`Unknown scenario metadata: ${item.metadata?.scenarioId}`);
        const sessionId = `eval-${runName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 60)}-${scenario.id}`;
        return withEvalScenarioObservation({
          scenarioId: scenario.id,
          sessionId,
          input: item.input,
          runName,
          fn: () =>
            runScenarioAgainstBackend({
              scenario,
              runName,
              backendUrl: args.backendUrl,
              observationPoller: pollLangfuseObservations,
            }),
        });
      },
      evaluators: [
        createDeterministicEvaluator(scenarioById),
        createLlmJudgeEvaluator(scenarioById, {
          requireLlmJudge: args.requireLlmJudge,
          skipLlmJudge: args.skipLlmJudge,
        }),
      ],
      runEvaluators: [aggregateEvaluator],
    });

    console.log(await result.format());
    console.log('');
    console.log(formatScenarioTable(result, scenarios));

    if (!args.noFail && shouldFail(result)) {
      process.exitCode = 1;
    }
  } finally {
    if (client instanceof LangfuseClient) await client.flush();
    await stopLangfuseOtel();
  }
}

class OfflineExperimentClient {
  readonly experiment = {
    run: async <Input, ExpectedOutput, Metadata extends Record<string, any>>(config: any) => {
      const itemResults = [];
      for (const item of config.data) {
        try {
          const output = await config.task(item);
          const evalsNested = await Promise.all(
            (config.evaluators || []).map(async (evaluator: any) => {
              const result = await evaluator({
                input: item.input,
                expectedOutput: item.expectedOutput,
                output,
                metadata: item.metadata,
              });
              return Array.isArray(result) ? result : [result];
            }),
          );
          itemResults.push({ item, input: item.input, expectedOutput: item.expectedOutput, output, evaluations: evalsNested.flat() });
        } catch (err) {
          throw err;
        }
      }
      const runEvaluations = (
        await Promise.all(
          (config.runEvaluators || []).map(async (evaluator: any) => {
            const result = await evaluator({ itemResults });
            return Array.isArray(result) ? result : [result];
          }),
        )
      ).flat();
      return {
        experimentId: 'offline',
        runName: config.runName,
        itemResults,
        runEvaluations,
        format: async () => {
          const scores = itemResults
            .map((item) => item.evaluations.map((score: any) => `${score.name}=${score.value}`).join(', '))
            .join('\n');
          const run = runEvaluations.map((score: any) => `${score.name}=${score.value}`).join(', ');
          return [`${config.name} (${config.runName})`, scores, run].filter(Boolean).join('\n');
        },
      } as any;
    },
  };
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
