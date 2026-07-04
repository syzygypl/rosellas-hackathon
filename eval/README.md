# Rosellas Langfuse Eval CLI

Root-level local evals for the Rosellas TRIZ chat surface.

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

## Environment

- `EVAL_BACKEND_URL`: API base, default `http://localhost:8080/api`.
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`: enable experiment traces, scores, and observation polling.
- `OPENAI_API_KEY`: enables the optional local LLM judge. Without it, deterministic scores still run and the judge is marked skipped.
- `EVAL_LLM_JUDGE_MODEL`: optional local judge model override. Falls back to `LANGFUSE_EVAL_MODEL`, then `gpt-4.1-mini`.
- `LANGFUSE_EVAL_PROVIDER` / `LANGFUSE_EVAL_MODEL`: optional hosted evaluator model config used by `eval:push`.

Hosted evaluator rules are inactive by default. Use `npm run eval:push -- --enable` only when live async scoring cost is intended.
