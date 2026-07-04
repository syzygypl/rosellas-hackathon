# Rosellas Langfuse Eval CLI

Root-level local evals for the Rosellas TRIZ chat surface.

## Layout

- `eval/scenarios/`: scenario cases. Add new SDG prompts here.
- `eval/evaluators/`: inspectable evaluator definitions, score names, rubrics, thresholds, hosted Langfuse payloads.
- `eval/framework/`: CLI, Langfuse plumbing, backend runner, and test harness code.

## Commands

```bash
npm run eval -- list
npm run eval -- run -s sdg12-ewaste --no-fail
npm run eval -- run -s sdg12-ewaste,sdg6-wastewater
npm run eval:push -- --dry-run
npm run eval:push -- --enable
```

`run` posts each scenario to `POST /api/chat` as:

```json
{
  "sessionId": "eval-<runName>-<scenarioId>",
  "messages": [{ "role": "user", "content": "<scenario prompt>" }]
}
```

The CLI prints the resolved backend URL, selected scenarios, whether Langfuse traces/scores/observation polling are active, LLM judge mode, per-scenario session IDs, response shape, latency, and Langfuse observation counts when available.

## Reading Run Output

The first block is the run configuration:

- `Run name`: unique Langfuse experiment run name and local session prefix.
- `Backend URL`: API base used for `POST /api/chat`.
- `Scenarios`: scenario ids selected for this run.
- `Max concurrency`: how many scenarios may run in parallel.
- `Langfuse`: whether the CLI found `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`. When enabled, the CLI creates Langfuse experiment traces/scores and polls observations for backend/tool activity.
- `LLM judge`: whether the optional local OpenAI judge is active. It requires `OPENAI_API_KEY`.

Each scenario block describes the backend call:

- `Session`: `sessionId` sent to `/api/chat`. Backend Langfuse traces use this to group the request.
- `Backend`: exact endpoint called.
- `Response`: response contract summary. `engine=agent` means the Deep Agent path answered; `solution=yes` means the side-panel solution card was present; `latency` is total wall-clock time for the scenario call and observation polling.
- `Langfuse observations`: observations found for the scenario session. `traces` is the distinct trace count, `tool-ish` is the subset whose name/type/metadata looks like TRIZ or tool activity, and `tokens`/`cost` are summed from Langfuse observation usage fields when present.

The experiment result is printed by the Langfuse SDK. `Individual Results: Hidden` is normal for compact output; the CLI follows it with its own scenario table. `Average Scores` are item-level evaluator averages across all selected scenarios. With one scenario, each average is that scenario's score.

Deterministic scores:

- `agent_engine_present`, `solution_card_present`, `triz_tool_trail_present`, `answer_brief`, and `forbidden_solution_patterns_absent` are boolean checks reported as `1.000` for pass and `0.000` for fail.
- `domain_criteria_coverage` is the fraction of required scenario criteria matched by keyword checks.
- `positive_signal_coverage` is the fraction of optional positive signals matched by keyword checks.
- `deterministic_overall` is the weighted aggregate from `eval/evaluators/deterministic.json`.

LLM judge scores:

- `llm_problem_fit`, `llm_triz_grounding`, `llm_feasibility_safety`, and `llm_overall_quality` are 0-1 rubric scores from the optional local judge model.
- `llm_judge_status` records whether the judge was `scored` or `skipped`.

Run evaluations:

- `run_average_deterministic` is the mean `deterministic_overall` across scenarios.
- `run_pass` is true when that average meets the configured threshold, currently `0.75`.

The final table is the quickest summary: scenario id, pass/fail, deterministic score (`det`), LLM overall score (`llm`), backend engine, solution-card presence, tool-ish observation count, and scenario title. `Langfuse: flushing queued scores` means the CLI is forcing locally queued Langfuse score writes to finish before exit.

## Environment

The CLI loads the project-root `.env` file automatically before reading these values.

- `EVAL_BACKEND_URL`: API base, default `http://localhost:8080/api`.
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`: enable experiment traces, scores, and observation polling.
- `OPENAI_API_KEY`: enables the optional local LLM judge. Without it, deterministic scores still run and the judge is marked skipped.
- `EVAL_LLM_JUDGE_MODEL`: optional local judge model override. Falls back to `LANGFUSE_EVAL_MODEL`, then `gpt-4.1-mini`.
- `LANGFUSE_EVAL_PROVIDER` / `LANGFUSE_EVAL_MODEL`: optional hosted evaluator model config used by `eval:push`.

Hosted evaluator rules are inactive by default. Use `npm run eval:push -- --enable` only when live async scoring cost is intended.
