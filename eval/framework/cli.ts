#!/usr/bin/env node
import 'dotenv/config';
import { LangfuseClient } from '@langfuse/client';
import { DEFAULT_BACKEND_URL, buildSessionId, normalizeApiBase, runScenarioAgainstBackend } from './backend';
import { parseArgs, usage } from './args';
import { aggregateEvaluator, createDeterministicEvaluator } from './evaluators';
import { createLlmJudgeEvaluator } from './judge';
import { loadLlmJudgeDefinition } from './evaluator-definitions';
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
    logPushHeader(args);
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
  const backendUrl = normalizeApiBase(args.backendUrl || process.env.EVAL_BACKEND_URL || DEFAULT_BACKEND_URL);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const data = scenarios.map((scenario) => ({
    input: scenario.prompt,
    expectedOutput: scenario.requiredCriteria.map((criterion) => criterion.description).join('\n'),
    metadata: { scenarioId: scenario.id },
  }));
  const langfuseConfigured = isLangfuseConfigured();
  const client = langfuseConfigured ? createLangfuseClient() : new OfflineExperimentClient();

  logRunHeader({ runName, backendUrl, scenarios, args, langfuseConfigured });
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
        backendUrl,
      },
      task: async (item) => {
        const scenario = scenarioById.get(item.metadata?.scenarioId || '');
        if (!scenario) throw new Error(`Unknown scenario metadata: ${item.metadata?.scenarioId}`);
        const sessionId = buildSessionId(runName, scenario.id);
        console.log(`\nScenario ${scenario.id}: ${scenario.title}`);
        console.log(`  Session: ${sessionId}`);
        console.log(`  Backend: POST ${backendUrl}/chat`);
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
        }).then((output) => {
          logScenarioOutput(output, langfuseConfigured);
          return output;
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

    console.log('\nExperiment result');
    console.log(await result.format());
    console.log('');
    console.log(formatScenarioTable(result, scenarios));

    if (!args.noFail && shouldFail(result)) {
      console.log('\nRun failed threshold checks; exiting with code 1.');
      process.exitCode = 1;
    } else {
      console.log(`\nRun completed${args.noFail ? ' (--no-fail set)' : ''}.`);
    }
  } finally {
    if (client instanceof LangfuseClient) {
      console.log('Langfuse: flushing queued scores.');
      await client.flush();
    }
    await stopLangfuseOtel();
  }
}

function logRunHeader(params: {
  runName: string;
  backendUrl: string;
  scenarios: EvalScenario[];
  args: ReturnType<typeof parseArgs>;
  langfuseConfigured: boolean;
}): void {
  console.log('Rosellas eval run');
  console.log(`  Run name: ${params.runName}`);
  console.log(`  Backend URL: ${params.backendUrl}`);
  console.log(`  Scenarios: ${params.scenarios.map((scenario) => scenario.id).join(', ')}`);
  console.log(`  Max concurrency: ${params.args.maxConcurrency}`);
  if (params.langfuseConfigured) {
    console.log(
      `  Langfuse: enabled (${process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'}); traces, scores, and observation polling will be used.`,
    );
  } else {
    console.log('  Langfuse: disabled; running local-only experiment, no remote traces/scores, observation polling skipped.');
  }

  if (params.args.skipLlmJudge) {
    console.log('  LLM judge: disabled by --skip-llm-judge.');
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    console.log(`  LLM judge: enabled (${currentJudgeModel()}).`);
  } else if (params.args.requireLlmJudge) {
    console.log('  LLM judge: required, but OPENAI_API_KEY is missing; run will fail before scoring.');
  } else {
    console.log('  LLM judge: skipped because OPENAI_API_KEY is not set.');
  }
}

function currentJudgeModel(): string {
  const definition = loadLlmJudgeDefinition();
  return (
    definition.modelEnvVars.map((envVar) => process.env[envVar]).find((value) => value?.trim()) ||
    definition.fallbackModel
  );
}

function logPushHeader(args: ReturnType<typeof parseArgs>): void {
  console.log('Rosellas hosted evaluator push');
  console.log(`  Mode: ${args.dryRun ? 'dry-run' : 'write to Langfuse public API'}`);
  console.log(`  Rules after push: ${args.enable ? 'enabled' : 'inactive'}`);
  console.log(`  Langfuse base URL: ${process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'}`);
}

function logScenarioOutput(output: ScenarioOutput, langfuseConfigured: boolean): void {
  console.log(`  Response: engine=${output.chat.engine || 'missing'}, solution=${output.chat.solution ? 'yes' : 'no'}, latency=${output.latencyMs}ms`);
  if (langfuseConfigured) {
    const obs = output.observations;
    const cost = obs.totalCost != null ? `, cost=${obs.totalCost}` : '';
    const tokens = obs.totalTokens != null ? `, tokens=${obs.totalTokens}` : '';
    const error = obs.error ? `, note=${obs.error}` : '';
    console.log(`  Langfuse observations: ${obs.count}, traces=${obs.traceIds.length}, tool-ish=${obs.toolTrail.length}${tokens}${cost}${error}`);
  } else {
    console.log('  Langfuse observations: skipped (credentials not configured).');
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
