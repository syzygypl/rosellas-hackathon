# Rosellas Hackathon

Two-service CRUD demo for Google Cloud Run:

- `frontend/`: Angular SPA served by nginx on Cloud Run.
- `backend/`: NestJS API under `/api`, backed by Firestore.
- root workspace: Nx monorepo orchestration over npm workspaces for `backend/` and `frontend/`.
- `.github/workflows/`: independent GitHub Actions workflows for infra bootstrap, backend deploy, and frontend deploy.

The deployment path is intentionally small: GitHub Actions authenticates to GCP with Workload Identity Federation, Google Cloud Build builds Docker images, Artifact Registry stores images, and Cloud Run runs the services.

## Local Development

Install dependencies from the repository root:

```bash
npm install
```

Run the backend:

```bash
GOOGLE_CLOUD_PROJECT=<project-id> npm run start:backend
```

Run the frontend:

```bash
npm run start:frontend
```

By default the local frontend calls `http://localhost:8080/api`.

Build through Nx:

```bash
npm run build
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
```

The workflows use one Artifact Registry Docker repository:

```text
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/crud-backend
europe-west1-docker.pkg.dev/<project-id>/cloud-run-apps/crud-frontend
```

Run `.github/workflows/infra-bootstrap.yml` manually once before the first deploy. It enables required APIs, creates Firestore if missing, and creates the `cloud-run-apps` Artifact Registry repository.

Current GCP links and resource URLs are documented in [docs/google-infra-links.md](docs/google-infra-links.md).

After that:

- changes under `backend/**` deploy only `crud-backend`;
- changes under `frontend/**` deploy only `crud-frontend`;
- frontend deploy resolves the current `crud-backend` Cloud Run URL and builds Angular with `API_URL=<backend-url>/api`;
- backend deploy sets `GOOGLE_CLOUD_PROJECT` and, when the frontend service already exists, `CORS_ORIGIN`.

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
