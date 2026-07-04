# Rosellas Hackathon

Nx workspace for the hackathon apps.

- `apps/general-ai-agent/`: NestJS API from the MVP branch.
- `apps/customer-portal/`: Angular CSR frontend and main customer-facing app.
- `apps/triz-mcp-server/`: Python MCP server exposing TRIZ tools over Streamable HTTP.
- `apps/examples/backend/`: previous example NestJS API under `/api`, backed by Firestore.
- `apps/examples/frontend/`: previous example Angular SPA served by nginx on Cloud Run.
- root workspace: Nx monorepo with one root `package.json` and `package-lock.json`.
- `.github/workflows/`: GitHub Actions workflows named after the Cloud Run services they deploy.
- `skills/`: AI agent startup skills for Codex, Cursor, and Claude.

## Prereqs

The TRIZ MCP server must be running and reachable at `MCP_URL` (default `http://localhost:8123/mcp`). It uses an external Ollama/OpenAI-compatible embeddings API through `EMBEDDING_SERVICE_URL`; Ollama is not hosted inside this monorepo.

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
# edit apps/triz-mcp-server/.env and set EMBEDDING_SERVICE_URL
npm run start:mcp
```

Run the main frontend:

```bash
npm run start:frontend
```

Open `http://localhost:4200`. The Angular frontend calls the backend at `http://localhost:8080/api` by default.

## AI Agent

The split app implements the core Event Storming flow from the Miro board:

`Problem Submitted -> Technical Contradiction Built -> TRIZ Parameters Mapped -> Matrix Lookup -> Principles Found -> Candidate directions -> Run Completed`.

How it works:

1. `search_parameter` maps free text to TRIZ engineering parameters via semantic search.
2. `browse_contradiction_matrix` looks up inventive principles for the improving/preserving pair.
3. `search_principle` adds related principles as extra candidate directions.

All TRIZ logic runs on the MCP server. No external LLM is required.

Backend config (`apps/general-ai-agent/.env`):

| var | default | meaning |
|-----|---------|---------|
| `PORT` | `8080` | backend port |
| `CORS_ORIGIN` | `http://localhost:4200` | allowed frontend origin |
| `MCP_URL` | `http://localhost:8123/mcp` | TRIZ MCP endpoint |
| `ANTHROPIC_API_KEY` | empty | optional, reserved for future LLM enrichment of candidates |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | optional future enrichment model |

Layout:

```text
apps/general-ai-agent/
  src/main.ts               bootstrap + CORS + /api prefix
  src/app.module.ts
  src/triz-mcp.service.ts   JSON-RPC client for the TRIZ MCP server
  src/solver.service.ts     pipeline orchestration
  src/solver.controller.ts  GET /api/health, POST /api/solve

apps/customer-portal/
  src/app/                  Angular CSR solver UI
  src/environments/         API URL configuration

apps/triz-mcp-server/
  app/main.py               FastMCP Streamable HTTP server
  app/tools/                registered TRIZ MCP tools
  app/services/triz.py      pytriz store and external embedding client
```

## Nx Commands

```bash
npm run build
npm run build:ai-agent
npm run build:backend
npm run build:frontend
npm run build:mcp
npm run start:backend
npm run start:frontend
npm run start:mcp
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
GCP_REGION=europe-west1
WIF_PROVIDER=projects/<project-number>/locations/global/workloadIdentityPools/github/providers/github
GCP_SERVICE_ACCOUNT=github-deployer@<project-id>.iam.gserviceaccount.com
MCP_URL=<deployed-or-private-triz-mcp-url>
EMBEDDING_SERVICE_URL=<external-ollama-openai-compatible-v1-url>
EMBEDDING_MODEL=embeddinggemma:300m
```

`MCP_URL` is optional for `general-ai-agent`: if it is not set, the backend workflow resolves the `triz-mcp-server` Cloud Run URL and appends `/mcp`. `EMBEDDING_SERVICE_URL` is required by the `triz-mcp-server` workflow. Set `EMBEDDING_API_KEY` as a GitHub Actions secret when the external Ollama endpoint needs a token; otherwise the workflow falls back to `ollama`.

The workflows use one Artifact Registry Docker repository:

```text
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/crud-backend
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/crud-frontend
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/general-ai-agent
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/customer-portal
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/triz-mcp-server
```

Run `.github/workflows/infra-bootstrap.yml` manually once before the first deploy. It enables required APIs, creates Firestore if missing, and creates the `cloud-run-apps` Artifact Registry repository.

Current GCP links and resource URLs are documented in [docs/google-infra-links.md](docs/google-infra-links.md).

AI agent startup skills are centralized in [skills/](skills/), with entry points for Codex, Cursor, and Claude documented in [docs/ai/README.md](docs/ai/README.md). Use [skills/add-new-application/SKILL.md](skills/add-new-application/SKILL.md) when adding another application to the monorepo.

After that:

- changes under `apps/examples/backend/**` deploy only `crud-backend`;
- changes under `apps/examples/frontend/**` deploy only `crud-frontend`;
- changes under `apps/general-ai-agent/**` deploy only `general-ai-agent`;
- changes under `apps/customer-portal/**` deploy only `customer-portal`;
- changes under `apps/triz-mcp-server/**` deploy only `triz-mcp-server`;
- frontend workflows resolve the paired backend Cloud Run URL and build Angular with `API_URL=<backend-url>/api`;
- backend workflows set version metadata and CORS for the paired frontend regional URL.
- `general-ai-agent` also sets `MCP_URL`, resolving `triz-mcp-server` automatically when `MCP_URL` is not configured manually.

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
