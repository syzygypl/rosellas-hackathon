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
- Example frontend: Angular 19 standalone SPA served by nginx from `apps/examples/frontend/`.
- Example backend: NestJS 10 CRUD API from `apps/examples/backend/`, globally prefixed with `/api`.
- Database: Google Firestore Native, default database, `items` collection.
- Deployment: GitHub Actions authenticates to GCP through Workload Identity Federation, Cloud Build builds Docker images, Artifact Registry stores them, Cloud Run serves frontend and backend.
- Primary region: `europe-west1`.

## Startup Checklist

1. Read this file first.
2. Check the worktree with `git status --short` and preserve user changes.
3. For current deployed URLs, Cloud Run revisions, GCP console links, and GitHub Actions links, read `docs/google-infra-links.md`.
4. For local build and deploy setup, read `README.md`.
5. Inspect only the subsystem needed for the task: `apps/examples/frontend/`, `apps/examples/backend/`, `.github/workflows/`, or `docs/`.

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
| Cloud Run images | `apps/examples/backend/Dockerfile`, `apps/examples/frontend/Dockerfile` | Service-specific container packaging. GitHub Actions builds Nx artifacts before Docker packaging. Backend uses `apps/examples/backend/cloudbuild.yaml` with repository root context. |
| Deploy workflows | `.github/workflows/` | Infra bootstrap plus service-specific workflows named after Cloud Run services. |
| Infra links | `docs/google-infra-links.md` | Current resource URLs and GCP identifiers. |
| Observability docs | `docs/google-observability.md` | Google Cloud Observability baseline, Logs Explorer filters, and cost guardrails. |
| Versioning docs | `docs/versioning/README.md` | Shared app version, build metadata, Swagger, UI badge, and workflow conventions. |
| New app skill | `skills/add-new-application/SKILL.md` | Procedure for adding Nx applications under repo conventions. |

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
```

Build:

```bash
npm run build
npm run build:backend
npm run build:frontend
npm run build:landing
npm run build:mcp
```

Unit tests (Jest, transpile-only ts-jest; specs live next to code as `*.spec.ts` under `apps/<app>/src/`):

```bash
npm test
```

Type-checking happens in the app builds, not in Jest. Use builds plus `npm test` as the baseline verification.

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
- `OPENAI_API_KEY`: optional OpenAI-compatible key for the Deep Agent chat. The backend also accepts `EMBEDDING_API_KEY` and legacy `OPEN_AI_API_KEY` as fallbacks, and maps the chosen key to LangChain.
- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`: optional; when both are set, the backend exports Langfuse traces for `/api/chat`, `/api/agent/solve`, `/api/solve`, LangChain model/agent calls, and Nest-side MCP tool calls.
- `LANGFUSE_BASE_URL`: defaults to `https://cloud.langfuse.com`.
- `LANGFUSE_TRACING_ENVIRONMENT`: optional Langfuse environment label; use `local` locally and a deployed label such as `production` in Cloud Run.
- `LANGCHAIN_CALLBACKS_BACKGROUND`: defaults to `false` in the env template so LangChain callbacks finish predictably in Cloud Run-style runtimes.

Frontend environment:

- Local Angular env points to `http://localhost:8080/api`.
- Local Angular env includes `appVersion`, `buildSha`, and `buildTime` fields used by the UI version badge.
- Frontend deploy workflows resolve the paired backend Cloud Run URL and rewrite the app production environment with `<backend-url>/api` plus frontend build metadata during the CI build.

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

Versioning details and the checklist for new apps live in `docs/versioning/README.md`.

## API Surface

Public backend base path: `/api` (both backends).

AI agent backend (`apps/general-ai-agent`, consumed by `apps/customer-portal`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `GET` | `/api/version` | Application version, commit SHA, and build time. |
| `POST` | `/api/chat` | Conversational TRIZ solver. Body: `{ messages: [{ role, content, solved? }] }` (max 40 messages, 8000 chars each). Returns `{ answer, engine, solution, suggestions?, warning? }`; `solution` carries the humanized side-panel card (`title`, `summary`, `contradiction`, `directions`, `nextSteps`) plus technical details (`parameters`, `principles`, `related`, `trail`, `report?`). |
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
- `general-ai-agent.yml`: builds `apps/general-ai-agent` through Nx, packages the prebuilt artifact with Docker, pushes `general-ai-agent`, sets `MCP_URL` to the regional `triz-mcp-server` Cloud Run URL when not configured manually, resolves an OpenAI-compatible key from `OPENAI_API_KEY`, `EMBEDDING_API_KEY`, or legacy `OPEN_AI_API_KEY`, and deploys Cloud Run.
- `customer-portal.yml`: resolves `general-ai-agent`, builds `apps/customer-portal` through Nx, packages the prebuilt artifact with Docker, pushes `customer-portal`, and deploys Cloud Run.
- `research-landing.yml`: resolves `customer-portal`, builds `apps/landing-page` through Nx, packages the prebuilt static artifact with Docker, pushes `research-landing`, and deploys Cloud Run.
- `triz-mcp-server.yml`: builds `apps/triz-mcp-server` through Nx, packages the Python app with Docker, pushes `triz-mcp-server`, sets external embeddings env vars and MCP allowed hosts, and deploys Cloud Run.

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
- Avoid committing `node_modules/`, `dist/`, `.angular/`, `.env`, `.env.*`, or local GCP credentials.
- Treat `apps/examples/frontend/src/environments/environment.prod.ts` as CI-rewritten for production deploys.
- Prefer narrow changes that match the existing small-demo architecture: Cloud Run, Firestore, GitHub Actions, no Kubernetes, no Terraform.
- If a change affects public endpoints, CORS, build arguments, image names, or resource URLs, update `README.md` and `docs/google-infra-links.md` when appropriate.

## Verification Matrix

Use the narrowest useful verification:

| Change type | Suggested verification |
| --- | --- |
| Backend TypeScript/API | `npm run build:backend` and `npm test` |
| Frontend Angular/UI/API client | `npm run build:frontend` and `npm test` |
| TRIZ MCP server | `npm run build:mcp`, then Docker smoke test against `/mcp` with `tools/list` and one semantic search tool. |
| Cross-service or root config | `npm run build` |
| Docs-only | Review rendered Markdown links and referenced paths. |
| Workflow/deploy changes | Static review first; run live GitHub/GCP commands only when explicitly requested. |
