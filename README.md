# Rosellas Hackathon

Nx workspace for the hackathon apps.

- `apps/ai-agent/`: NestJS backend from the MVP branch. It serves the TRIZ solver API and a small built-in UI.
- `apps/examples/frontend/`: Angular SPA served by nginx on Cloud Run.
- `apps/examples/backend/`: previous example NestJS API under `/api`, backed by Firestore.
- root workspace: Nx monorepo with one root `package.json` and `package-lock.json`.
- `.github/workflows/`: GitHub Actions workflows for infra bootstrap, backend deploy, and frontend deploy.
- `skills/`: AI agent startup skills for Codex, Cursor, and Claude.

## Prereqs

The TRIZ MCP server must be running and reachable at `MCP_URL` (default `http://localhost:8123/mcp`), with its embedding service up.

Install dependencies from the repository root:

```bash
npm install
```

Run the AI agent backend:

```bash
cp apps/ai-agent/.env.example apps/ai-agent/.env
npm run start:backend
```

Open `http://localhost:3000`, enter a free-text problem, and the backend returns detected TRIZ parameters, a technical contradiction, principles from the contradiction matrix, related principles, and a reasoning trail.

Run the example frontend:

```bash
npm run start:frontend
```

## AI Agent Backend

The `ai-agent` Nx project implements the core Event Storming flow from the Miro board:

`Problem Submitted -> Technical Contradiction Built -> TRIZ Parameters Mapped -> Matrix Lookup -> Principles Found -> Candidate directions -> Run Completed`.

How it works:

1. `search_parameter` maps free text to TRIZ engineering parameters via semantic search.
2. `browse_contradiction_matrix` looks up inventive principles for the improving/preserving pair.
3. `search_principle` adds related principles as extra candidate directions.

All TRIZ logic runs on the MCP server. No external LLM is required.

Config (`apps/ai-agent/.env`):

| var | default | meaning |
|-----|---------|---------|
| `PORT` | `3000` | backend port |
| `MCP_URL` | `http://localhost:8123/mcp` | TRIZ MCP endpoint |
| `ANTHROPIC_API_KEY` | empty | optional, reserved for future LLM enrichment of candidates |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | optional future enrichment model |

Layout:

```text
apps/ai-agent/src/
  main.ts               bootstrap + CORS + .env
  app.module.ts
  triz-mcp.service.ts   JSON-RPC client for the TRIZ MCP server
  solver.service.ts     pipeline orchestration
  solver.controller.ts  GET /, GET /health, POST /api/solve
apps/ai-agent/public/index.html
```

## Nx Commands

```bash
npm run build
npm run build:ai-agent
npm run build:backend
npm run build:frontend
```

## GitHub Actions Configuration

Create these GitHub Actions repository variables:

```text
GCP_PROJECT_ID=<project-id>
GCP_REGION=europe-west1
WIF_PROVIDER=projects/<project-number>/locations/global/workloadIdentityPools/github/providers/github
GCP_SERVICE_ACCOUNT=github-deployer@<project-id>.iam.gserviceaccount.com
MCP_URL=<deployed-or-private-triz-mcp-url>
```

The workflows use one Artifact Registry Docker repository:

```text
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/ai-agent
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/crud-frontend
```

Run `.github/workflows/infra-bootstrap.yml` manually once before the first deploy. It enables required APIs, creates Firestore if missing, and creates the `cloud-run-apps` Artifact Registry repository.

Current GCP links and resource URLs are documented in [docs/google-infra-links.md](docs/google-infra-links.md).

AI agent startup skills are centralized in [skills/](skills/), with entry points for Codex, Cursor, and Claude documented in [docs/ai/README.md](docs/ai/README.md).

After that:

- changes under `apps/ai-agent/**` deploy only `ai-agent`;
- changes under `apps/examples/frontend/**` deploy only `crud-frontend`;
- frontend deploy resolves the current backend Cloud Run URL and builds Angular with `API_URL=<backend-url>/api`;
- backend deploy sets `MCP_URL` when the repository variable exists.

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
