# Evaluator Definitions

Inspectable eval definitions live here. The TypeScript under `eval/framework/` loads these files and handles CLI/runtime mechanics.

Current definitions:

- `deterministic.json`: local, cost-free checks and score weights.
- `llm-judge.json`: optional local OpenAI judge rubric and score names.
- `hosted-langfuse.json`: Langfuse-hosted evaluator/rule payloads pushed by `npm run eval:push`.

To add a new scenario, add a file under `eval/scenarios/`.
To add or adjust scoring behavior, add or edit a file in this directory and update the framework only when a new evaluator type needs new execution logic.
