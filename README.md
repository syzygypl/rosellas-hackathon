# Rosellas Hackathon

## Cloud Addresses

Project: `crud-hackathon-ml-20260703`, region: `europe-west1`.

- GCP Console: https://console.cloud.google.com/home/dashboard?project=crud-hackathon-ml-20260703
- Cloud Run services: https://console.cloud.google.com/run?project=crud-hackathon-ml-20260703
- Logs Explorer: https://console.cloud.google.com/logs/query?project=crud-hackathon-ml-20260703
- Error Reporting: https://console.cloud.google.com/errors?project=crud-hackathon-ml-20260703
- Monitoring: https://console.cloud.google.com/monitoring?project=crud-hackathon-ml-20260703

Public service URLs:

- `general-ai-agent`: https://general-ai-agent-59918194944.europe-west1.run.app
- `triz-mcp-server`: https://triz-mcp-server-59918194944.europe-west1.run.app
- `crud-backend`: https://crud-backend-sjd2cgjmta-ew.a.run.app
- `crud-frontend`: https://crud-frontend-sjd2cgjmta-ew.a.run.app

Full infrastructure links live in [docs/google-infra-links.md](docs/google-infra-links.md).

Nx workspace for the hackathon apps.

- `apps/general-ai-agent/`: NestJS API from the MVP branch.
- `apps/landing-page/`: static Angular landing page for the research platform, served by nginx on Cloud Run.
- `apps/customer-portal/`: Angular CSR frontend and main customer-facing app.
- `apps/triz-mcp-server/`: Python MCP server exposing TRIZ tools over Streamable HTTP.
- `apps/examples/backend/`: previous example NestJS API under `/api`, backed by Firestore.
- `apps/examples/frontend/`: previous example Angular SPA served by nginx on Cloud Run.
- root workspace: Nx monorepo with one root `package.json` and `package-lock.json`.
- `.github/workflows/`: GitHub Actions workflows named after the Cloud Run services they deploy.
- `skills/`: AI agent startup skills for Codex, Cursor, and Claude.

## Prereqs

The TRIZ MCP server must be running and reachable at `MCP_URL` (default `http://localhost:8123/mcp`). It uses an external OpenAI-compatible embeddings API through `EMBEDDING_SERVICE_URL`; embedding infrastructure is not hosted inside this monorepo.

Install dependencies from the repository root:

```bash
npm install
```

Run the backend:

```bash
cp apps/general-ai-agent/.env.example apps/general-ai-agent/.env
npm run start:backend
```

Run the MCP server:

```bash
cp apps/triz-mcp-server/.env.example apps/triz-mcp-server/.env
# edit apps/triz-mcp-server/.env and set EMBEDDING_API_KEY
npm run start:mcp
```

Run the main frontend:

```bash
npm run start:frontend
```

Open `http://localhost:4200`. The Angular frontend calls the backend at `http://localhost:8080/api` by default.

Run the landing page:

```bash
npm run start:landing
```

Open `http://localhost:4300`. The "Enter Workspace" actions point to `http://localhost:4200` locally.

## AI Agent

The split app implements the core Event Storming flow from the Miro board:

`Problem Submitted -> Technical Contradiction Built -> TRIZ Parameters Mapped -> Matrix Lookup -> Principles Found -> Candidate directions -> Run Completed`.

The frontend is an **interactive chat** (`apps/customer-portal`): the user
converses on the left, and every solved run lands as a card in a **solutions
side panel** on the right (detected parameters, technical contradiction,
inventive principles, full report, reasoning trail).

`POST /api/chat` (full message history in the body) picks one of two engines
per turn:

- **agent** (when `OPENAI_API_KEY` is set) — a LangChain Deep Agent whose tools
  are discovered at runtime from the TRIZ MCP server. A fast intake gate first
  checks whether the system, the thing to improve and the thing that worsens
  are all known — if not, the turn returns one short clarifying question
  (max 3 per conversation). Long reports are compressed to a ~80-word chat
  summary; the full report goes to the solution card. Prompts live in
  `apps/general-ai-agent/src/prompts/*.md`.
- **pipeline** (fallback, LLM-free) — the deterministic flow below; the
  response carries a configuration warning shown as a toast in the UI:
  1. `search_parameter` maps free text to TRIZ engineering parameters via semantic search.
  2. `browse_contradiction_matrix` looks up inventive principles for the improving/preserving pair.
  3. `search_principle` adds related principles as extra candidate directions.

All TRIZ logic runs on the MCP server. Without an OpenAI key the app still
works — no external LLM is required.

Backend config (`apps/general-ai-agent/.env`):

| var | default | meaning |
|-----|---------|---------|
| `BACKEND_PORT` | `8080` | local backend port; use this instead of generic `PORT` in root `.env` |
| `PORT` | Cloud Run provided | production runtime port; ignored by local backend starts unless `NODE_ENV=production` |
| `CORS_ORIGIN` | `http://localhost:4200` | allowed frontend origin |
| `MCP_URL` | `http://localhost:8123/mcp` | TRIZ MCP endpoint |
| `ANTHROPIC_API_KEY` | empty | optional, reserved for future LLM enrichment of candidates |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | optional future enrichment model |
| `OPENAI_API_KEY` | empty | optional, enables the Deep Agent chat (`/api/chat`, `/api/agent/solve`); falls back to `EMBEDDING_API_KEY`, then legacy `OPEN_AI_API_KEY` |
| `OPENAI_MODEL` | `gpt-5.5` | model used by the Deep Agent |
| `OPENAI_REASONING_EFFORT` | `low` | reasoning effort for reasoning models |
| `LANGFUSE_PUBLIC_KEY` | empty | optional with `LANGFUSE_SECRET_KEY`; enables Langfuse traces for backend AI flows |
| `LANGFUSE_SECRET_KEY` | empty | optional secret key for Langfuse trace export |
| `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` | Langfuse host, override for self-hosted or non-default regions |
| `LANGFUSE_TRACING_ENVIRONMENT` | `local` | Langfuse environment label |
| `LANGCHAIN_CALLBACKS_BACKGROUND` | `false` | keeps LangChain callback export synchronous enough for Cloud Run shutdowns |
| `LOG_LEVEL` | `INFO` | Cloud Run structured application log level; use `WARNING` to reduce log volume |

## Google Cloud Observability

The deployed Cloud Run services use the free/cost-safe Google Observability
baseline:

- Cloud Run built-in metrics and request/container/system logs.
- Structured JSON application logs from the NestJS backends and TRIZ MCP server.
- Error Reporting entries for unhandled/5xx backend errors and MCP tool
  exceptions.
- No custom metrics, Prometheus samples, or custom OpenTelemetry spans by
  default.

The infra bootstrap workflow enables Cloud Logging, Cloud Monitoring, Error
Reporting, and Cloud Trace APIs. Details, Logs Explorer filters, and cost
guardrails are in [docs/google-observability.md](docs/google-observability.md).

Layout:

```text
apps/general-ai-agent/
  src/main.ts               bootstrap + CORS + /api prefix
  src/app.module.ts
  src/triz-mcp.service.ts   JSON-RPC client for the TRIZ MCP server
  src/solver.service.ts     pipeline orchestration
  src/agent.service.ts      LangChain Deep Agent + intake gate + summarizer
  src/chat.service.ts       chat orchestration (agent or pipeline per turn)
  src/prompt-loader.ts      loads prompts from src/prompts/*.md
  src/prompts/              agent-system, intake-system, summary-system
  src/solver.controller.ts  GET /api/health, POST /api/solve, /api/agent/solve, /api/chat

apps/customer-portal/
  src/app/                  Angular chat UI + solutions side panel
  src/environments/         API URL configuration

apps/triz-mcp-server/
  app/main.py               FastMCP Streamable HTTP server
  app/tools/                registered TRIZ MCP tools
  app/services/triz.py      pytriz store and external embedding client

apps/landing-page/
  src/app/                  static research landing page
  src/environments/         workspace URL and build metadata
```

## Nx Commands

```bash
npm run build
npm run build:ai-agent
npm run build:backend
npm run build:frontend
npm run build:mcp
npm run build:landing
npm run start:backend
npm run start:frontend
npm run start:mcp
npm run start:landing
```

The old CRUD examples remain available through:

```bash
npm run build:example-backend
npm run build:example-frontend
npm run start:example-backend
npm run start:example-frontend
```

The frontend displays frontend and backend build metadata. The backend exposes the same metadata at `/api/version`, and Swagger is available at `/api/docs`.
Versioning conventions for new applications are documented in [docs/versioning/README.md](docs/versioning/README.md).

## GitHub Actions Configuration

Create these GitHub Actions repository variables:

```text
GCP_PROJECT_ID=<project-id>
GCP_PROJECT_NUMBER=<project-number>
GCP_REGION=europe-west1
WIF_PROVIDER=projects/<project-number>/locations/global/workloadIdentityPools/github/providers/github
GCP_SERVICE_ACCOUNT=github-deployer@<project-id>.iam.gserviceaccount.com
MCP_URL=<deployed-or-private-triz-mcp-url>
EMBEDDING_SERVICE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

`MCP_URL` is optional for `general-ai-agent`: if it is not set, the backend workflow uses the regional `triz-mcp-server` Cloud Run URL and appends `/mcp`. The MCP workflow uses `GCP_PROJECT_NUMBER` to allow the Cloud Run Host header in MCP transport security. Set `EMBEDDING_API_KEY` as a GitHub Actions repository secret for the `triz-mcp-server` embeddings client. Set `OPENAI_API_KEY` as a GitHub Actions secret to enable the Deep Agent chat on the deployed `general-ai-agent`; if it is absent, the workflow falls back to `EMBEDDING_API_KEY`, then legacy `OPEN_AI_API_KEY`. Without any compatible key the chat falls back to the LLM-free pipeline. `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` repository variables override the defaults. Set `LANGFUSE_SECRET_KEY` as a secret and `LANGFUSE_PUBLIC_KEY` as a repository variable to enable deployed Langfuse tracing; `LANGFUSE_BASE_URL` and `LANGFUSE_TRACING_ENVIRONMENT` are optional variables.

The workflows use one Artifact Registry Docker repository:

```text
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/crud-backend
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/crud-frontend
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/general-ai-agent
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/customer-portal
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/triz-mcp-server
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/research-landing
```

Run `.github/workflows/infra-bootstrap.yml` manually once before the first deploy. It enables required APIs, creates Firestore if missing, and creates the `cloud-run-apps` Artifact Registry repository.

Current GCP links and resource URLs are documented in [docs/google-infra-links.md](docs/google-infra-links.md).

AI agent startup skills are centralized in [skills/](skills/), with entry points for Codex, Cursor, and Claude documented in [docs/ai/README.md](docs/ai/README.md). Use [skills/add-new-application/SKILL.md](skills/add-new-application/SKILL.md) when adding another application to the monorepo.

After that:

- changes under `apps/examples/backend/**` deploy only `crud-backend`;
- changes under `apps/examples/frontend/**` deploy only `crud-frontend`;
- changes under `apps/general-ai-agent/**` deploy only `general-ai-agent`;
- changes under `apps/landing-page/**` deploy only `research-landing`;
- changes under `apps/customer-portal/**` deploy only `customer-portal`;
- changes under `apps/triz-mcp-server/**` deploy only `triz-mcp-server`;
- frontend workflows resolve the paired backend Cloud Run URL and build Angular with `API_URL=<backend-url>/api`;
- the landing workflow resolves the `customer-portal` Cloud Run URL and builds Angular with `workspaceUrl=<customer-portal-url>`;
- backend workflows set version metadata and CORS for the paired frontend regional URL.
- `general-ai-agent` also sets `MCP_URL`, using the regional `triz-mcp-server` URL automatically when `MCP_URL` is not configured manually.

## One-Time GCP IAM

Do this outside GitHub Actions once, using `gcloud` authenticated as an owner/admin of the target project. Replace values as needed:

```bash
PROJECT_ID=<project-id>
REGION=europe-west1
GITHUB_REPO=syzygypl/rosellas-hackathon
SA_NAME=github-deployer
POOL_ID=github
PROVIDER_ID=github

gcloud iam service-accounts create "$SA_NAME" \
  --project "$PROJECT_ID" \
  --display-name "GitHub Actions deployer"

SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

for ROLE in \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.admin \
  roles/datastore.owner \
  roles/serviceusage.serviceUsageAdmin \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:$SA_EMAIL" \
    --role "$ROLE" \
    --quiet
done

gcloud iam workload-identity-pools create "$POOL_ID" \
  --project "$PROJECT_ID" \
  --location global \
  --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project "$PROJECT_ID" \
  --location global \
  --workload-identity-pool "$POOL_ID" \
  --display-name "GitHub" \
  --attribute-mapping "google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository == '$GITHUB_REPO'" \
  --issuer-uri "https://token.actions.githubusercontent.com"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/attribute.repository/$GITHUB_REPO" \
  --quiet
```

Cloud Build also needs permission to push images to Artifact Registry. If your project uses the default Cloud Build service account, grant it writer access:

```bash
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role roles/artifactregistry.writer \
  --quiet
```

## Next Steps

- LLM enrichment: turn principles into concrete candidate solutions, score them, and pick the best. Hook is stubbed via `ANTHROPIC_API_KEY`.
- Persist runs and expose the reasoning trail as a shareable artifact.
