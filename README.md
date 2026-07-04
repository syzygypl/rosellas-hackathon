# 🧩 Inventive Problem Solver — MVP

NestJS backend + a single-page frontend that turns a **technical contradiction**
into concrete **TRIZ inventive principles**, powered by the workshop's TRIZ MCP
server (embedding-backed semantic search + contradiction matrix).

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

Open http://localhost:3000, fill in:
- **Problem** — free-text situation
- **Co chcemy poprawić?** — what to improve
- **Co się przez to pogarsza?** — what gets worse

You get: mapped TRIZ parameters (+ alternatives), inventive principles from the
contradiction matrix, related principles as extra idea directions, and a
reasoning trail.

## How it works

1. `search_parameter` (semantic, via embeddings) maps free text → TRIZ engineering parameters.
2. `browse_contradiction_matrix` looks up inventive principles for the improving/preserving pair.
3. `search_principle` adds related principles as extra candidate directions.

All TRIZ logic runs on the MCP server — **no external LLM is required**.

## Config (`.env`)

| var | default | meaning |
|-----|---------|---------|
| `PORT` | `3000` | backend port |
| `MCP_URL` | `http://localhost:8123/mcp` | TRIZ MCP endpoint |
| `ANTHROPIC_API_KEY` | *(empty)* | optional — reserved for future LLM enrichment of candidates |

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
  solver.controller.ts  GET / (UI), GET /health, POST /api/solve
public/index.html       the whole frontend
```

## Next steps (out of MVP scope)

- LLM enrichment: turn principles → concrete, phrased candidate solutions (SCAMPER),
  score/evaluate them, pick the best (board events 15–37). Hook is stubbed via `ANTHROPIC_API_KEY`.
- Persist runs; expose the reasoning trail as a shareable artifact.
