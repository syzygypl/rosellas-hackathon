# Google Infrastructure Links

Stan na: 2026-07-04

## Projekt

| Element | Wartość |
| --- | --- |
| Project ID | `crud-hackathon-ml-20260703` |
| Project number | `59918194944` |
| Region | `europe-west1` |
| GCP Console | https://console.cloud.google.com/home/dashboard?project=crud-hackathon-ml-20260703 |

## Cloud Run

| Usługa | Publiczny URL | Konsola | Aktualna rewizja | Aktualny obraz |
| --- | --- | --- | --- | --- |
| `crud-backend` | https://crud-backend-sjd2cgjmta-ew.a.run.app | https://console.cloud.google.com/run/detail/europe-west1/crud-backend/metrics?project=crud-hackathon-ml-20260703 | `crud-backend-00005-dpd` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-source-deploy/crud-backend@sha256:5899938eabac79752c6e6b97cd1cdeb06fba51f87d6e9280904695e58b1e8cd9` |
| `crud-frontend` | https://crud-frontend-sjd2cgjmta-ew.a.run.app | https://console.cloud.google.com/run/detail/europe-west1/crud-frontend/metrics?project=crud-hackathon-ml-20260703 | `crud-frontend-00002-cp7` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-source-deploy/crud-frontend@sha256:bc4325205fe0d257e690d59b864d12f5457770ccdd932dde1d75b3bcb6671d7c` |

Przydatne endpointy:

| Endpoint | URL |
| --- | --- |
| Frontend | https://crud-frontend-sjd2cgjmta-ew.a.run.app |
| Backend health | https://crud-backend-sjd2cgjmta-ew.a.run.app/api/health |
| Backend Swagger | https://crud-backend-sjd2cgjmta-ew.a.run.app/api/docs |
| Backend API base | https://crud-backend-sjd2cgjmta-ew.a.run.app/api |

Uwaga: obecne usługi Cloud Run działają jeszcze na obrazach z repozytorium `cloud-run-source-deploy`. Nowe workflowy w tym repo budują i deployują obrazy z `cloud-run-apps`.

## Artifact Registry

| Element | URL |
| --- | --- |
| Repozytorium `cloud-run-apps` | https://console.cloud.google.com/artifacts/docker/crud-hackathon-ml-20260703/europe-west1/cloud-run-apps?project=crud-hackathon-ml-20260703 |
| Repozytorium `cloud-run-source-deploy` | https://console.cloud.google.com/artifacts/docker/crud-hackathon-ml-20260703/europe-west1/cloud-run-source-deploy?project=crud-hackathon-ml-20260703 |

Docelowe obrazy używane przez workflowy:

| Aplikacja | Obraz |
| --- | --- |
| Backend | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/crud-backend` |
| Frontend | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/crud-frontend` |

Zweryfikowane smoke buildy z obecnego repo:

| Aplikacja | Tag | Digest |
| --- | --- | --- |
| Backend | `manual-smoke-current` | `sha256:4a79c47db30136ad900bb74dae11bf990207f7ac59604e15301c9120cbf5ba29` |
| Frontend | `manual-smoke-current` | `sha256:f77a28b37c00a8d8e1246e2ac5ac16204d971e856483612a12eecb4296b6648f` |

## Firestore

| Element | Wartość |
| --- | --- |
| Database | `(default)` |
| Mode | `FIRESTORE_NATIVE` |
| Location | `europe-west1` |
| Console | https://console.cloud.google.com/firestore/databases?project=crud-hackathon-ml-20260703 |
| Data viewer | https://console.cloud.google.com/firestore/data?project=crud-hackathon-ml-20260703 |

Backend używa kolekcji `items`.

## Cloud Build

| Element | URL |
| --- | --- |
| Build history | https://console.cloud.google.com/cloud-build/builds?project=crud-hackathon-ml-20260703 |
| Triggers | https://console.cloud.google.com/cloud-build/triggers?project=crud-hackathon-ml-20260703 |
| Source upload bucket | https://console.cloud.google.com/storage/browser/crud-hackathon-ml-20260703_cloudbuild?project=crud-hackathon-ml-20260703 |

Ostatnie smoke buildy:

| Build | Status | URL |
| --- | --- | --- |
| Backend `manual-smoke-current` | `SUCCESS` | https://console.cloud.google.com/cloud-build/builds/64fd3044-2278-4d0e-abc6-580e93fcabd1?project=59918194944 |
| Frontend `manual-smoke-current` | `SUCCESS` | https://console.cloud.google.com/cloud-build/builds/5eccc989-0cd6-49bb-85e0-83bbd89c57fc?project=59918194944 |

## IAM / Workload Identity Federation

| Element | Wartość |
| --- | --- |
| GitHub deployer service account | `github-deployer@crud-hackathon-ml-20260703.iam.gserviceaccount.com` |
| Service accounts | https://console.cloud.google.com/iam-admin/serviceaccounts?project=crud-hackathon-ml-20260703 |
| IAM policy | https://console.cloud.google.com/iam-admin/iam?project=crud-hackathon-ml-20260703 |
| Workload Identity Pools | https://console.cloud.google.com/iam-admin/workload-identity-pools?project=crud-hackathon-ml-20260703 |
| Provider resource | `projects/59918194944/locations/global/workloadIdentityPools/github/providers/github` |
| Provider condition | `assertion.repository == 'syzygypl/rosellas-hackathon'` |
| Cloud Build source bucket role | `roles/storage.objectAdmin` on `gs://crud-hackathon-ml-20260703_cloudbuild` |

Role nadane `github-deployer`:

- `roles/artifactregistry.admin`
- `roles/cloudbuild.builds.editor`
- `roles/datastore.owner`
- `roles/iam.serviceAccountUser`
- `roles/run.admin`
- `roles/serviceusage.serviceUsageAdmin`

## Enabled APIs

| API | Console |
| --- | --- |
| Cloud Run API | https://console.cloud.google.com/apis/library/run.googleapis.com?project=crud-hackathon-ml-20260703 |
| Cloud Build API | https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=crud-hackathon-ml-20260703 |
| Artifact Registry API | https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=crud-hackathon-ml-20260703 |
| Firestore API | https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=crud-hackathon-ml-20260703 |

## GitHub Actions

Te linki nie są częścią GCP, ale są punktem wejścia do deployu tej infrastruktury:

| Workflow | URL |
| --- | --- |
| Infra Bootstrap | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/infra-bootstrap.yml |
| Backend Deploy | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/backend-deploy.yml |
| Frontend Deploy | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/frontend-deploy.yml |

Ustawione GitHub Actions variables:

- `GCP_PROJECT_ID=crud-hackathon-ml-20260703`
- `GCP_REGION=europe-west1`
- `WIF_PROVIDER=projects/59918194944/locations/global/workloadIdentityPools/github/providers/github`
- `GCP_SERVICE_ACCOUNT=github-deployer@crud-hackathon-ml-20260703.iam.gserviceaccount.com`
