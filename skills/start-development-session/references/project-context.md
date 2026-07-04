# Rosellas Hackathon Project Context

Use this document to load the Rosellas Hackathon project context before changing code, docs, infrastructure, or deployment workflows.

## Project Snapshot

- Repository: `rosellas-hackathon`
- Purpose: hackathon Nx workspace with deployed Cloud Run apps and retained CRUD examples.
- Workspace: Nx 23 monorepo with a single root `package.json` and `package-lock.json`.
- Main frontend: Angular 19 standalone SPA served by nginx from `apps/customer-portal/`.
- Main backend: NestJS 10 API from `apps/general-ai-agent/`, globally prefixed with `/api`.
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
| Nx config | `nx.json`, `apps/examples/backend/project.json`, `apps/examples/frontend/project.json` | Defines backend/frontend projects and cacheable build targets. |
| Backend entrypoint | `apps/examples/backend/src/main.ts` | Sets `/api`, CORS, validation pipe, Swagger at `/api/docs`, port default `8080`. |
| Backend module | `apps/examples/backend/src/app.module.ts` | Registers health and items modules. |
| Items API | `apps/examples/backend/src/items/` | Controller, DTOs, Firestore-backed service. |
| Frontend app | `apps/examples/frontend/src/app/` | Standalone Angular component, model, service, styles. |
| Frontend env | `apps/examples/frontend/src/environments/` | Local default API URL is `http://localhost:8080/api`; workflow rewrites prod env during deploy. |
| Cloud Run images | `apps/examples/backend/Dockerfile`, `apps/examples/frontend/Dockerfile` | Service-specific container packaging. GitHub Actions builds Nx artifacts before Docker packaging. Backend uses `apps/examples/backend/cloudbuild.yaml` with repository root context. |
| Deploy workflows | `.github/workflows/` | Infra bootstrap plus service-specific workflows named after Cloud Run services. |
| Infra links | `docs/google-infra-links.md` | Current resource URLs and GCP identifiers. |
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
```

Build:

```bash
npm run build
npm run build:backend
npm run build:frontend
```

There are currently no dedicated test scripts in either package. Use builds as the baseline verification unless the task adds tests.

## Runtime Configuration

Backend environment:

- `PORT`: defaults to `8080`.
- `GOOGLE_CLOUD_PROJECT` or `GCLOUD_PROJECT`: project ID for Firebase Admin / Firestore.
- `CORS_ORIGIN`: comma-separated allowed origins. Defaults locally to `http://localhost:4200` and `http://localhost:5000`.
- `APP_VERSION`: displayed in Swagger and returned by `/api/version`; CI sets this from root `package.json`.
- `GIT_SHA`: commit SHA returned by `/api/version`; CI sets this from `GITHUB_SHA`.
- `BUILD_TIME`: UTC ISO timestamp returned by `/api/version`; CI sets this during deploy.

Frontend environment:

- Local Angular env points to `http://localhost:8080/api`.
- Local Angular env includes `appVersion`, `buildSha`, and `buildTime` fields used by the UI version badge.
- Frontend deploy workflows resolve the paired backend Cloud Run URL and rewrite the app production environment with `<backend-url>/api` plus frontend build metadata during the CI build.

Versioning details and the checklist for new apps live in `docs/versioning/README.md`.

## API Surface

Public backend base path: `/api`.

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
- `general-ai-agent.yml`: builds `apps/general-ai-agent` through Nx, packages the prebuilt artifact with Docker, pushes `general-ai-agent`, sets `MCP_URL`, and deploys Cloud Run.
- `customer-portal.yml`: resolves `general-ai-agent`, builds `apps/customer-portal` through Nx, packages the prebuilt artifact with Docker, pushes `customer-portal`, and deploys Cloud Run.

Workflow files and workflow `name` values should match the Cloud Run service they deploy.

Required GitHub Actions variables:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `WIF_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `MCP_URL` for `general-ai-agent`

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
| Backend TypeScript/API | `npm run build:backend` |
| Frontend Angular/UI/API client | `npm run build:frontend` |
| Cross-service or root config | `npm run build` |
| Docs-only | Review rendered Markdown links and referenced paths. |
| Workflow/deploy changes | Static review first; run live GitHub/GCP commands only when explicitly requested. |
