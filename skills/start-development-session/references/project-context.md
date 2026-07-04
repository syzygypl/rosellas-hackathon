# Rosellas Hackathon Project Context

Use this document to load the Rosellas Hackathon project context before changing code, docs, infrastructure, or deployment workflows.

## Project Snapshot

- Repository: `rosellas-hackathon`
- Purpose: hackathon Nx workspace with deployed Cloud Run apps and retained CRUD examples.
- Workspace: Nx 23 monorepo with a single root `package.json` and `package-lock.json`.
- Landing page: Angular 19 static landing app served by nginx from `apps/landing-page/`.
- Main frontend: Angular 19 standalone SPA served by nginx from `apps/customer-portal/`.
- Main backend: NestJS 10 API from `apps/general-ai-agent/`, globally prefixed with `/api`.
- TRIZ MCP server: Python FastMCP service from `apps/triz-mcp-server/`, exposed over Streamable HTTP at `/mcp` and using an external OpenAI-compatible embeddings API.
- Figma generator: Nx project wrapper from `apps/figma-generator/` for validating and building the local Figma design system plugin.
- SCAMPER MCP server: Python FastMCP service from `apps/scamper-mcp-server/`, exposed over Streamable HTTP at `/mcp`; serves a static SCAMPER lens knowledge base, no embeddings API needed. The Deep Agent runs both TRIZ and SCAMPER and picks the best solution.
- Eval CLI: root `eval/` subsystem runs local SDG scenarios against the AI agent `/api/chat` surface, records/scores Langfuse experiments when configured, and can push inactive hosted evaluator definitions.
- Example frontend: Angular 19 standalone SPA served by nginx from `apps/examples/frontend/`.
- Example backend: NestJS 10 CRUD API from `apps/examples/backend/`, globally prefixed with `/api`.
- Database: Google Firestore Native, default database, `items` collection.
- Deployment: GitHub Actions authenticates to GCP through Workload Identity Federation, Cloud Build builds Docker images, Artifact Registry stores them, Cloud Run serves frontend and backend.
- Design system: repository-owned Idealab tokens and single-page Figma UI kit manifest under `design-system/`, validated by GitHub Actions and exported as a free local Figma plugin artifact.
- Primary region: `europe-west1`.

## Startup Checklist

1. Read this file first.
2. Check the worktree with `git status --short` and preserve user changes.
3. For current deployed URLs, Cloud Run revisions, GCP console links, and GitHub Actions links, read `docs/google-infra-links.md`.
4. For local build and deploy setup, read `README.md`.
5. Inspect only the subsystem needed for the task: `apps/examples/frontend/`, `apps/examples/backend/`, `apps/figma-generator/`, `.github/workflows/`, or `docs/`.

## Key Paths

| Area | Path | Notes |
| --- | --- | --- |
| Root commands | `package.json` | Nx-backed scripts for builds, starts, graph, and project orchestration. |
| Nx config | `nx.json`, app-level `project.json` files | Defines app projects and cacheable build targets. |
| Landing page | `apps/landing-page/src/app/` | Static Idealab research landing page with workspace CTA. |
| Landing env | `apps/landing-page/src/environments/` | Local workspace URL is `http://localhost:4200`; workflow rewrites prod env during deploy. |
| Backend entrypoint | `apps/examples/backend/src/main.ts` | Sets `/api`, CORS, validation pipe, Swagger at `/api/docs`, port default `8080`. |
| Backend module | `apps/examples/backend/src/app.module.ts` | Registers health and items modules. |
| Items API | `apps/examples/backend/src/items/` | Controller, DTOs, Firestore-backed service. |
| Frontend app | `apps/examples/frontend/src/app/` | Standalone Angular component, model, service, styles. |
| Frontend env | `apps/examples/frontend/src/environments/` | Local default API URL is `http://localhost:8080/api`; workflow rewrites prod env during deploy. |
| TRIZ MCP app | `apps/triz-mcp-server/` | Python FastMCP server with TRIZ tools, Dockerfile, uv lockfile, and Nx build/serve targets. |
| TRIZ MCP config | `apps/triz-mcp-server/app/core/config.py` | Reads MCP bind settings and external embeddings provider settings. |
| Figma generator | `apps/figma-generator/` | Nx project wrapper for `design-system/` and `tools/design-system/` validation and plugin build. |
| SCAMPER MCP app | `apps/scamper-mcp-server/` | Python FastMCP server with SCAMPER lens tools, Dockerfile, uv lockfile, and Nx build/serve targets. |
| SCAMPER MCP data | `apps/scamper-mcp-server/app/services/scamper.py` | Static dataset of the seven SCAMPER lenses (questions, examples). |
| Eval CLI | `eval/` | Local eval suite. `eval/scenarios/` contains scenario JSON, `eval/evaluators/` contains inspectable evaluator definitions, and `eval/framework/` contains CLI/runtime code. |
| Cloud Run images | `apps/examples/backend/Dockerfile`, `apps/examples/frontend/Dockerfile` | Service-specific container packaging. GitHub Actions builds Nx artifacts before Docker packaging. Backend uses `apps/examples/backend/cloudbuild.yaml` with repository root context. |
| Deploy workflows | `.github/workflows/` | Infra bootstrap plus service-specific workflows named after Cloud Run services. |
| Design system | `design-system/`, `tools/design-system/`, `.github/workflows/design-system.yml` | Repository-owned tokens, single-page Figma UI kit manifest, local validation, and free local Figma plugin build. The local plugin uses one `Rosellas · Design System` page so it works in Figma files limited to three pages. |
| Infra links | `docs/google-infra-links.md` | Current resource URLs and GCP identifiers. |
| Observability docs | `docs/google-observability.md` | Google Cloud Observability baseline, Logs Explorer filters, and cost guardrails. |
| Versioning docs | `docs/versioning/README.md` | Shared app version, build metadata, Swagger, UI badge, and workflow conventions. |
| New app skill | `skills/add-new-application/SKILL.md` | Procedure for adding Nx applications under repo conventions. |
| Figma generator skill | `skills/generate-figma-design-system/SKILL.md` | Procedure for validating, building, importing, and troubleshooting the local Figma design system plugin. |

## Local Commands

Install dependencies if missing:

```bash
npm install
```

The root install owns all application dependencies. There are no per-app `package.json` or `package-lock.json` files under `apps/examples/`.

Run locally:

```bash
npm run start:backend
npm run start:frontend
npm run start:landing
npm run start:mcp
npm run start:scamper
```

Run local evals against the AI agent backend:

```bash
npm run eval -- list
npm run eval -- run -s sdg12-ewaste --no-fail
npm run eval -- run -s sdg12-ewaste,sdg6-wastewater
npm run eval:push -- --dry-run
```

Build:

```bash
npm run build
npm run build:backend
npm run build:frontend
npm run build:landing
npm run build:mcp
npm run build:scamper
npm run build:figma-generator
npm run design-system:validate
npm run design-system:figma:plugin:build
```

Unit tests (Jest, transpile-only ts-jest; specs live next to code as `*.spec.ts` under `apps/<app>/src/` and `eval/framework/`):

```bash
npm test
```

Type-checking happens in the app builds, not in Jest. Use builds plus `npm test` as the baseline verification.
For design system changes, use `npm run design-system:validate` and `npm run design-system:figma:plugin:build`.

## Runtime Configuration

Backend environment:

- `BACKEND_PORT`: local backend port, defaults to `8080`.
- `PORT`: production runtime port for Cloud Run; local backend starts ignore generic root `PORT` unless `NODE_ENV=production`.
- `GOOGLE_CLOUD_PROJECT` or `GCLOUD_PROJECT`: project ID for Firebase Admin / Firestore.
- `CORS_ORIGIN`: comma-separated allowed origins. Defaults locally to `http://localhost:4200` and `http://localhost:5000`.
- `APP_VERSION`: displayed in Swagger and returned by `/api/version`; CI sets this from root `package.json`.
- `GIT_SHA`: commit SHA returned by `/api/version`; CI sets this from `GITHUB_SHA`.
- `BUILD_TIME`: UTC ISO timestamp returned by `/api/version`; CI sets this during deploy.
- `LOG_LEVEL`: Cloud Run structured application log threshold; defaults to `INFO`.
- `MCP_URL`: TRIZ MCP server URL, defaults to `http://localhost:8123/mcp`.
- `SCAMPER_MCP_URL`: SCAMPER MCP server URL, defaults to `http://localhost:8124/mcp`. The Deep Agent loads SCAMPER tools best-effort — when the server is unreachable at agent build time, the chat runs TRIZ-only until restart.
- `OPENAI_API_KEY`: optional OpenAI-compatible key for the Deep Agent chat. The backend also accepts `EMBEDDING_API_KEY` and legacy `OPEN_AI_API_KEY` as fallbacks, and maps the chosen key to LangChain.
- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`: optional; when both are set, the backend exports Langfuse traces for `/api/chat`, `/api/agent/solve`, `/api/solve`, LangChain model/agent calls, and Nest-side MCP tool calls.
- `LANGFUSE_BASE_URL`: defaults to `https://cloud.langfuse.com`.
- `LANGFUSE_TRACING_ENVIRONMENT`: optional Langfuse environment label; use `local` locally and a deployed label such as `production` in Cloud Run.
- `LANGCHAIN_CALLBACKS_BACKGROUND`: defaults to `false` in the env template so LangChain callbacks finish predictably in Cloud Run-style runtimes.

Eval CLI environment:

- The eval CLI loads the project-root `.env` file automatically before reading env vars.
- `EVAL_BACKEND_URL`: defaults to `http://localhost:8080/api` and targets the AI agent backend `POST /api/chat`.
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`: enable SDK experiment traces, scores, and observation polling.
- `OPENAI_API_KEY`: optional local LLM judge key. Without it, deterministic scores still run unless `--require-llm-judge` is passed.
- `EVAL_LLM_JUDGE_MODEL`: optional local judge model override. Falls back to `LANGFUSE_EVAL_MODEL`, then `gpt-4.1-mini`.
- `LANGFUSE_EVAL_PROVIDER` / `LANGFUSE_EVAL_MODEL`: optional hosted LLM-as-judge model config used by `npm run eval:push`.

Frontend environment:

- Local Angular env points to `http://localhost:8080/api`.
- Local Angular env includes `appVersion`, `buildSha`, and `buildTime` fields used by the UI version badge.
- The customer portal creates a per-browser-tab chat `sessionId`, displays it as muted copyable text at the bottom of the chat, and sends it with every `/api/chat` request.
- Frontend deploy workflows resolve the paired backend Cloud Run URL and rewrite the app production environment with `<backend-url>/api` plus frontend build metadata during the CI build.
- Static frontend nginx images emit `Strict-Transport-Security: max-age=31536000; includeSubDomains` so browsers keep the custom domains on HTTPS after the first secure visit.

Landing page environment:

- Local Angular env points `workspaceUrl` to `http://localhost:4200`.
- The landing deploy workflow resolves the deployed `customer-portal` Cloud Run URL and rewrites the app production environment with that URL plus build metadata during the CI build.

TRIZ MCP environment:

- `MCP_HOST`: defaults to `0.0.0.0`.
- `MCP_PORT`: defaults to `8123`; the Docker image sets this to `8080`.
- `PORT`: optional Cloud Run bind port override; when present it takes precedence over `MCP_PORT`.
- `MCP_ALLOWED_HOSTS`: comma-separated Host headers accepted by MCP DNS rebinding protection. Cloud Run deploy sets this to the deployed regional service host plus local hosts.
- `MCP_ALLOWED_ORIGINS`: comma-separated Origin headers accepted by MCP DNS rebinding protection when an Origin header is present.
- `MCP_DNS_REBINDING_PROTECTION`: defaults to `true`.
- `LOG_LEVEL`: Cloud Run structured application log threshold; defaults to `INFO`.
- `EMBEDDING_SERVICE_URL`: external OpenAI-compatible embeddings API base URL. Current deployed default is `https://api.openai.com/v1`.
- `EMBEDDING_MODEL`: embeddings model name. Current deployed default is `text-embedding-3-small`.
- `EMBEDDING_API_KEY`: required for semantic TRIZ tools in deploy. `OPENAI_API_KEY` and local legacy `OPEN_AI_API_KEY` are accepted as fallbacks.
- The MCP index is built lazily on the first semantic search call so health and `tools/list` do not require an embeddings request during startup.

SCAMPER MCP environment:

- `MCP_HOST`: defaults to `0.0.0.0`.
- `MCP_PORT`: defaults to `8124`; the Docker image sets this to `8080`.
- `PORT`: optional Cloud Run bind port override; when present it takes precedence over `MCP_PORT`.
- `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, `MCP_DNS_REBINDING_PROTECTION`, `LOG_LEVEL`: same semantics as the TRIZ MCP server.
- No embeddings configuration — the SCAMPER lens knowledge base is static.

Versioning details and the checklist for new apps live in `docs/versioning/README.md`.

## API Surface

Public backend base path: `/api` (both backends).

AI agent backend (`apps/general-ai-agent`, consumed by `apps/customer-portal`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `GET` | `/api/version` | Application version, commit SHA, and build time. |
| `POST` | `/api/chat` | Conversational solver running both TRIZ and SCAMPER, picking the single best solution. Body: `{ sessionId?, messages: [{ role, content, solved? }] }` (max 40 messages, 8000 chars each). Returns `{ answer, engine, solution, suggestions?, warning? }`; `solution` leads with the winner (`bestDirection`, `whyBest`, `method`, `methodRationale`) and keeps runner-up `directions` viewable, plus the humanized card (`title`, `summary`, `contradiction`, `nextSteps`) and technical details (`parameters`, `principles`, `related`, `trail`, `report?`). |
| `POST` | `/api/solve` | LLM-free deterministic TRIZ pipeline. Body: `{ problem }`. |
| `POST` | `/api/agent/solve` | One-shot Deep Agent solve. Body: `{ problem }`; requires `OPENAI_API_KEY`. |

Example CRUD backend (`apps/examples/backend`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `GET` | `/api/version` | Application version, commit SHA, and build time. |
| `GET` | `/api/docs` | Swagger UI. |
| `GET` | `/api/items` | List items ordered by `updatedAt` descending. |
| `GET` | `/api/items/:id` | Fetch one item. |
| `POST` | `/api/items` | Create item. |
| `PATCH` | `/api/items/:id` | Update item. |
| `DELETE` | `/api/items/:id` | Delete item and return `{ deleted: true }`. |

Item fields:

- `id`
- `title`
- `description`
- `createdAt`
- `updatedAt`

When changing the item shape, update the backend DTOs/service and the frontend model/service together.

## Deployment Notes

GitHub Actions workflows:

- `infra-bootstrap.yml`: enables required Google APIs, ensures Firestore, and ensures the `cloud-run-apps` Artifact Registry repository.
- `crud-backend.yml`: builds `apps/examples/backend` through Nx, packages the prebuilt artifact with Docker, pushes `crud-backend`, and deploys Cloud Run.
- `crud-frontend.yml`: resolves `crud-backend`, builds `apps/examples/frontend` through Nx, packages the prebuilt artifact with Docker, pushes `crud-frontend`, and deploys Cloud Run.
- `general-ai-agent.yml`: builds `apps/general-ai-agent` through Nx, packages the prebuilt artifact with Docker, pushes `general-ai-agent`, sets `MCP_URL`/`SCAMPER_MCP_URL` to the regional `triz-mcp-server`/`scamper-mcp-server` Cloud Run URLs when not configured manually, resolves an OpenAI-compatible key from `OPENAI_API_KEY`, `EMBEDDING_API_KEY`, or legacy `OPEN_AI_API_KEY`, and deploys Cloud Run.
- `customer-portal.yml`: resolves `general-ai-agent`, builds `apps/customer-portal` through Nx, packages the prebuilt artifact with Docker, pushes `customer-portal`, and deploys Cloud Run.
- `research-landing.yml`: resolves `customer-portal`, builds `apps/landing-page` through Nx, packages the prebuilt static artifact with Docker, pushes `research-landing`, and deploys Cloud Run.
- `triz-mcp-server.yml`: builds `apps/triz-mcp-server` through Nx, packages the Python app with Docker, pushes `triz-mcp-server`, sets external embeddings env vars and MCP allowed hosts, and deploys Cloud Run.
- `scamper-mcp-server.yml`: compile-checks `apps/scamper-mcp-server`, packages the Python app with Docker, pushes `scamper-mcp-server`, sets MCP allowed hosts, and deploys Cloud Run (no embeddings configuration).
- `design-system.yml`: validates `apps/figma-generator/`, `design-system/`, and `tools/design-system/`, then builds the free local Figma plugin artifact.

Workflow files and workflow `name` values should match the Cloud Run service they deploy.

Required GitHub Actions variables:

- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_REGION`
- `WIF_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `EMBEDDING_SERVICE_URL` for `triz-mcp-server` (`https://api.openai.com/v1`)
- `EMBEDDING_MODEL` for `triz-mcp-server` (`text-embedding-3-small`)
- `MCP_URL` for `general-ai-agent` only if the workflow should not auto-resolve `triz-mcp-server`
- `SCAMPER_MCP_URL` for `general-ai-agent` only if the workflow should not auto-resolve `scamper-mcp-server`
Required GitHub Actions secrets:

- `EMBEDDING_API_KEY` for `triz-mcp-server`

Optional GitHub Actions variables:

- `LANGFUSE_PUBLIC_KEY` for optional `general-ai-agent` tracing

Optional GitHub Actions secrets:

- `OPENAI_API_KEY` for `general-ai-agent`; if absent, deploy falls back to `EMBEDDING_API_KEY`, then legacy `OPEN_AI_API_KEY`
- `LANGFUSE_SECRET_KEY` for optional `general-ai-agent` tracing

Google Observability baseline:

- Cloud Run built-in metrics and request/container/system logs are used by default.
- NestJS backends emit structured JSON logs and report only 5xx/unhandled exceptions to Error Reporting.
- The TRIZ MCP server emits structured JSON logs and reports tool exceptions through Cloud Logging/Error Reporting-compatible entries.
- The baseline intentionally avoids custom metrics, Prometheus samples, and custom OpenTelemetry spans to stay cost-safe.

Do not assume deployed URLs are current from memory. Use `docs/google-infra-links.md` first, then verify with GCP/GitHub only when the user asks for live validation.

## Change Guidelines

- Keep backend changes aligned with Swagger DTOs and validation.
- Keep frontend API calls centralized in `apps/examples/frontend/src/app/services/items.service.ts`.
- When adding an app, use `skills/add-new-application/SKILL.md` and apply `docs/versioning/README.md`.
- When changing design-system tokens, the Figma generator, plugin import docs, or Figma workflow behavior, use `skills/generate-figma-design-system/SKILL.md`.
- Avoid committing `node_modules/`, `dist/`, `.angular/`, `.env`, `.env.*`, or local GCP credentials.
- Treat `apps/examples/frontend/src/environments/environment.prod.ts` as CI-rewritten for production deploys.
- Prefer narrow changes that match the existing small-demo architecture: Cloud Run, Firestore, GitHub Actions, no Kubernetes, no Terraform.
- If a change affects public endpoints, CORS, build arguments, image names, or resource URLs, update `README.md` and `docs/google-infra-links.md` when appropriate.

## Verification Matrix

Use the narrowest useful verification:

| Change type | Suggested verification |
| --- | --- |
| Backend TypeScript/API | `npm run build:backend` and `npm test` |
| Eval CLI | `npm test`, `npm run eval -- list`, and `npm run eval:push -- --dry-run`; use `npm run eval -- run ... --no-fail` when a backend is running. |
| Frontend Angular/UI/API client | `npm run build:frontend` and `npm test` |
| TRIZ MCP server | `npm run build:mcp`, then Docker smoke test against `/mcp` with `tools/list` and one semantic search tool. |
| SCAMPER MCP server | `npm run build:scamper`, then smoke test against `/mcp` with `tools/list` and one lens tool. |
| Cross-service or root config | `npm run build` |
| Docs-only | Review rendered Markdown links and referenced paths. |
| Workflow/deploy changes | Static review first; run live GitHub/GCP commands only when explicitly requested. |
| Design system tokens/workflow | `npm run design-system:validate`, `npm run design-system:figma:plugin:build` |
