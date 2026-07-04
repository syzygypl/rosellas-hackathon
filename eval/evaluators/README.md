# Evaluator Definitions

Inspectable eval definitions live here. The TypeScript under `eval/framework/` loads these files and handles CLI/runtime mechanics.

## Directory Contract

- Files in this directory describe scoring behavior, score names, thresholds, rubrics, or hosted Langfuse payloads.
- Files under `eval/framework/` execute those definitions: loading JSON, calling the backend, running local evaluators, pushing hosted evaluators, and printing reports.
- Files under `eval/scenarios/` provide scenario-specific prompts, required criteria, positive signals, and forbidden patterns.

To add a new scenario, add a file under `eval/scenarios/`.
To add or adjust scoring behavior, add or edit a file in this directory and update the framework only when a new evaluator type needs new execution logic.

## Common Fields

Each evaluator definition has:

- `id`: stable local identifier for humans and tests.
- `type`: evaluator family. The framework uses this to make intent clear, but current loading is file-specific.
- `description`: short explanation of what the evaluator is for.

Score entries generally use:

- `name`: Langfuse score name emitted by the eval run.
- `dataType`: score type expected by Langfuse, usually `BOOLEAN`, `NUMERIC`, or `CATEGORICAL`.
- `description`: human-readable meaning of the score.
- `field`: for LLM judge scores, the JSON field expected from the judge model before mapping to `name`.

## `deterministic.json`

Local, cost-free evaluator for checks that should be stable and fast.

Main structure:

- `passThreshold`: per-scenario threshold for `deterministic_overall`.
- `runPassThreshold`: run-level threshold for `run_average_deterministic`.
- `toolTrailPattern`: regex used to decide whether the response or Langfuse observations show TRIZ/tool activity.
- `weights`: weighting used to compute `deterministic_overall`.
- `scores`: score metadata emitted by the local deterministic evaluator and run evaluator.

How it is used:

- `eval/framework/evaluators.ts` computes the component checks.
- Scenario-specific keyword coverage comes from `eval/scenarios/*.json`.
- `deterministic_overall` is computed per scenario.
- `run_average_deterministic` and `run_pass` are computed once across the whole selected scenario set.

When to edit:

- Tune thresholds or weights.
- Rename/add documented score names, if the framework is also updated to emit them.
- Adjust the tool trail regex when backend tool naming changes.

## `llm-judge.json`

Optional local LLM-as-judge definition. It runs during `npm run eval -- run ...` only when `OPENAI_API_KEY` is available, unless disabled by `--skip-llm-judge`.

Main structure:

- `modelEnvVars`: env vars checked, in order, for the local judge model.
- `fallbackModel`: model used if none of `modelEnvVars` are set.
- `systemPrompt`: instruction sent to the judge model.
- `rubric`: named rubric dimensions included in the judge prompt.
- `scores`: mapping from judge JSON fields to Langfuse score names.
- `statusScoreName`: categorical score recording whether the judge was `scored` or `skipped`.

How it is used:

- `eval/framework/judge.ts` sends scenario input, backend output, solution text, engine, tool trail, and this rubric to OpenAI.
- The judge must return numeric JSON fields matching the `field` values.
- The framework maps those fields to the configured `name` values.

When to edit:

- Change judge model fallback or env var precedence.
- Tighten or expand the rubric.
- Add a judge dimension, with a matching framework expectation if the output shape changes.

## `hosted-langfuse.json`

Definitions pushed to Langfuse by:

```bash
npm run eval:push -- --dry-run
npm run eval:push -- --enable
```

Main structure:

- `evaluators`: evaluator families to create or version in Langfuse.
- `rules`: evaluation rules that attach hosted evaluators to matching observations.

Current hosted evaluators:

- `rosellas.solution_quality`: hosted LLM-as-judge evaluator for `eval.scenario` observations.
- `rosellas.chat_contract`: hosted TypeScript code evaluator that checks answer, solution, and engine presence.

Current hosted rules:

- Target `observation`.
- Filter to observations named `eval.scenario`.
- Filter to traces tagged `rosellas-eval`.
- Stay inactive by default; the framework changes `enabled` only when `--enable` is passed.

Special field:

- `modelConfigFromEnv`: not sent directly to Langfuse. `eval/framework/push.ts` resolves it from `LANGFUSE_EVAL_PROVIDER` and `LANGFUSE_EVAL_MODEL`, then sends `modelConfig`.

When to edit:

- Add or change hosted evaluator payloads.
- Change hosted rule filters, mappings, sampling, or default enabled state.
- Update hosted code evaluator source.

## Adding A New Evaluator Type

Adding a new JSON file is enough only when an existing framework path can load and execute it. If the evaluator needs new runtime behavior, add framework code under `eval/framework/`, add tests next to it, and document the new JSON contract here.
