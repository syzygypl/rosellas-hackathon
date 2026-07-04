# 🧩 Inventive Problem Solver — MVP

NestJS backend + a single-page **chat** frontend that turns a **technical
contradiction** into concrete **TRIZ inventive principles**, powered by the
workshop's TRIZ MCP server (embedding-backed semantic search + contradiction
matrix). The UI is an interactive conversation on the left, with every solution
(parameters, contradiction, principles, reasoning trail) accumulating as cards
in a side panel on the right.

Implements the core of the Event Storming flow from the Miro board:
`Problem Submitted → Technical Contradiction Built → TRIZ Parameters Mapped →
Matrix Lookup → Principles Found → Candidate directions → Run Completed`.

## Prereqs

The TRIZ MCP server must be running (Docker) and reachable at `MCP_URL`
(default `http://localhost:8123/mcp`), with its embedding service up.

## Run

```bash
cp .env.example .env   # optional — code defaults work without it
npm install
npm start              # http://localhost:3000
```

Open http://localhost:3000 and just **chat**: describe the problem, then refine
or ask follow-ups. Each solved run lands as a card in the **solutions panel**
on the right (detected TRIZ parameters, technical contradiction, inventive
principles from the matrix, related directions, reasoning trail); follow-up
questions are answered in the chat without adding new cards.

## How it works

The chat endpoint (`POST /api/chat`, full message history in the body) picks
one of two engines per turn:

- **agent** (when `OPENAI_API_KEY` is set) — the LangChain Deep Agent runs the
  conversation with the whole history and calls TRIZ MCP tools as needed; its
  tool calls are distilled into the side-panel card.
- **pipeline** (fallback, LLM-free) — every user turn is treated as a (refined)
  problem statement and routed through the deterministic pipeline:
  1. `search_parameter` (semantic, via embeddings) maps free text → TRIZ engineering parameters.
  2. `browse_contradiction_matrix` looks up inventive principles for the improving/preserving pair.
  3. `search_principle` adds related principles as extra candidate directions.

All TRIZ logic runs on the MCP server — with no OpenAI key the app still works,
**no external LLM is required**.

## Config (`.env`)

| var | default | meaning |
|-----|---------|---------|
| `PORT` | `3000` | backend port |
| `MCP_URL` | `http://localhost:8123/mcp` | TRIZ MCP endpoint |
| `ANTHROPIC_API_KEY` | *(empty)* | optional — reserved for future LLM enrichment of candidates |
| `OPENAI_API_KEY` | *(empty)* | required only for the Deep Agent endpoint (`/api/agent/solve`) |
| `OPENAI_MODEL` | `gpt-5.5` | model used by the Deep Agent |
| `OPENAI_REASONING_EFFORT` | `low` | reasoning effort for reasoning models (ignored by others) |

> Note: this MVP lives at the repo root (branch `mvp`). The team's original
> `backend/`, `frontend/` and `docs/` folders from `master` are untouched and
> still buildable via their own `package.json` (e.g. `npm --prefix backend run build`).

## Layout

```
src/
  main.ts               bootstrap + CORS + .env
  app.module.ts
  triz-mcp.service.ts   JSON-RPC client for the TRIZ MCP server
  solver.service.ts     pipeline orchestration (the board's event flow)
  agent.service.ts      LangChain Deep Agent over the same MCP server
  chat.service.ts       interactive chat orchestration (agent or pipeline per turn)
  solver.controller.ts  GET / (UI), GET /health, POST /api/solve, /api/agent/solve, /api/chat
public/index.html       the whole frontend (chat + solutions side panel)
```

## Deep Agent endpoint

`POST /api/agent/solve` is an alternative, **agentic** solving path: a
[LangChain Deep Agent](https://github.com/langchain-ai/deepagents) (running
in-process, TypeScript) drives an LLM that plans its own TRIZ workflow. Its
tools are **discovered at runtime** from the TRIZ MCP server via
`@langchain/mcp-adapters` (`tools/list` on `MCP_URL`) — nothing is mocked or
hardcoded. The deterministic `/api/solve` pipeline is untouched and still
LLM-free.

Requirements: the TRIZ MCP server running at `MCP_URL`, and `OPENAI_API_KEY`
set in `.env` (`OPENAI_MODEL` defaults to `gpt-5.5`, with
`OPENAI_REASONING_EFFORT=low`). Without the key the endpoint returns `503`
and the rest of the app works as before.

```bash
curl -s http://localhost:3000/api/agent/solve \
  -X POST -H 'Content-Type: application/json' \
  -d '{"problem":"I want an aircraft wing that is strong but light"}'
```

Response shape (excerpt):

```json
{
  "problem": "I want an aircraft wing that is strong but light",
  "answer": "## TRIZ report\n**Contradiction:** improving Strength [14] vs. worsening Weight of moving object [1] ...",
  "toolCalls": [
    { "tool": "search_parameter", "args": { "query": "strength" }, "output": "• [14] Strength ..." },
    { "tool": "browse_contradiction_matrix", "args": { "improving_params": [14], "preserving_params": [1] }, "output": "... Principles: 1, 8, 40, 15 ..." },
    { "tool": "get_principle_by_id", "args": { "principle_id": 40 }, "output": "Principle 40: Composite materials ..." }
  ]
}
```

### Verifying the agent really used the MCP server

1. `toolCalls[]` in the response is non-empty and contains real TRIZ tool names
   (`search_parameter`, `browse_contradiction_matrix`, `get_principle_by_id`, …)
   with outputs matching TRIZ data.
2. The Nest log prints one `AgentService` line per tool call
   (`Tool call: search_parameter({"query":...})`).
3. The TRIZ MCP server's own log shows the corresponding `tools/call` requests.

## Next steps (out of MVP scope)

- LLM enrichment: turn principles → concrete, phrased candidate solutions (SCAMPER),
  score/evaluate them, pick the best (board events 15–37). Hook is stubbed via `ANTHROPIC_API_KEY`.
- Persist runs; expose the reasoning trail as a shareable artifact.
