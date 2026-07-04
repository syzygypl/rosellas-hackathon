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
| `general-ai-agent` | https://general-ai-agent-59918194944.europe-west1.run.app | https://console.cloud.google.com/run/detail/europe-west1/general-ai-agent/metrics?project=crud-hackathon-ml-20260703 | `general-ai-agent-00007-rkx` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/general-ai-agent:ab337fe7a19f140df24ee8849f466d7ae78c9898` |
| `triz-mcp-server` | https://triz-mcp-server-59918194944.europe-west1.run.app | https://console.cloud.google.com/run/detail/europe-west1/triz-mcp-server/metrics?project=crud-hackathon-ml-20260703 | `triz-mcp-server-00003-vxr` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/triz-mcp-server:ab337fe7a19f140df24ee8849f466d7ae78c9898` |

Przydatne endpointy:

| Endpoint | URL |
| --- | --- |
| Frontend | https://crud-frontend-sjd2cgjmta-ew.a.run.app |
| Backend health | https://crud-backend-sjd2cgjmta-ew.a.run.app/api/health |
| Backend Swagger | https://crud-backend-sjd2cgjmta-ew.a.run.app/api/docs |
| Backend API base | https://crud-backend-sjd2cgjmta-ew.a.run.app/api |
| AI Agent API base | https://general-ai-agent-59918194944.europe-west1.run.app/api |
| AI Agent health | https://general-ai-agent-59918194944.europe-west1.run.app/api/health |
| AI Agent solve | https://general-ai-agent-59918194944.europe-west1.run.app/api/solve |
| TRIZ MCP | https://triz-mcp-server-59918194944.europe-west1.run.app/mcp |

Uwaga: przykładowe usługi CRUD działają jeszcze na obrazach z repozytorium `cloud-run-source-deploy`. Nowe workflowy w tym repo budują i deployują obrazy z `cloud-run-apps`.

## Artifact Registry

| Element | URL |
| --- | --- |
| Repozytorium `cloud-run-apps` | https://console.cloud.google.com/artifacts/docker/crud-hackathon-ml-20260703/europe-west1/cloud-run-apps?project=crud-hackathon-ml-20260703 |
| Repozytorium `cloud-run-source-deploy` | https://console.cloud.google.com/artifacts/docker/crud-hackathon-ml-20260703/europe-west1/cloud-run-source-deploy?project=crud-hackathon-ml-20260703 |

Docelowe obrazy używane przez workflowy:

| Aplikacja | Obraz |
| --- | --- |
| `crud-backend` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/crud-backend` |
| `crud-frontend` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/crud-frontend` |
| `general-ai-agent` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/general-ai-agent` |
| `customer-portal` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/customer-portal` |
| `triz-mcp-server` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/triz-mcp-server` |
| `research-landing` | `europe-west1-docker.pkg.dev/crud-hackathon-ml-20260703/cloud-run-apps/research-landing` |

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

Obecna usługa `crud-backend` używa kolekcji `items`. Nowy backend `general-ai-agent` komunikuje się z TRIZ MCP i nie używa Firestore w bieżącym MVP.

## Cloud Build

| Element | URL |
| --- | --- |
| Build history | https://console.cloud.google.com/cloud-build/builds?project=crud-hackathon-ml-20260703 |
| Triggers | https://console.cloud.google.com/cloud-build/triggers?project=crud-hackathon-ml-20260703 |
| Source upload bucket | https://console.cloud.google.com/storage/browser/crud-hackathon-ml-20260703_cloudbuild?project=crud-hackathon-ml-20260703 |
| GitHub Actions source/log staging bucket | https://console.cloud.google.com/storage/browser/crud-hackathon-ml-20260703-github-cloud-build-source?project=crud-hackathon-ml-20260703 |

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
| Cloud Build source bucket roles | `roles/storage.objectAdmin`, `roles/storage.legacyBucketReader` on `gs://crud-hackathon-ml-20260703_cloudbuild` |
| GitHub Cloud Build staging bucket roles | `roles/storage.objectAdmin`, `roles/storage.legacyBucketReader` on `gs://crud-hackathon-ml-20260703-github-cloud-build-source` |
| Cloud Build logs writer | `roles/storage.objectAdmin`, `roles/storage.legacyBucketReader` on `gs://crud-hackathon-ml-20260703-github-cloud-build-source` for `59918194944-compute@developer.gserviceaccount.com` |
| WIF quota project role | `roles/serviceusage.serviceUsageConsumer` for `principalSet://iam.googleapis.com/projects/59918194944/locations/global/workloadIdentityPools/github/attribute.repository/syzygypl/rosellas-hackathon` |
| WIF Cloud Build bucket roles | `roles/storage.objectAdmin`, `roles/storage.legacyBucketReader` on `gs://crud-hackathon-ml-20260703_cloudbuild` for the same GitHub repository principalSet |
| WIF token creation role | `roles/iam.serviceAccountTokenCreator` on `github-deployer@crud-hackathon-ml-20260703.iam.gserviceaccount.com` for the same GitHub repository principalSet |

Role nadane `github-deployer`:

- `roles/artifactregistry.admin`
- `roles/cloudbuild.builds.editor`
- `roles/datastore.owner`
- `roles/iam.serviceAccountUser`
- `roles/run.admin`
- `roles/serviceusage.serviceUsageAdmin`

## Enabled APIs

Uwaga: API obserwowalności dodane w tym branchu są zarządzane przez `infra-bootstrap.yml`.
Uruchom workflow bootstrap przed pierwszym użyciem, jeśli nie są jeszcze aktywne w projekcie.

| API | Console |
| --- | --- |
| Cloud Run API | https://console.cloud.google.com/apis/library/run.googleapis.com?project=crud-hackathon-ml-20260703 |
| Cloud Build API | https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=crud-hackathon-ml-20260703 |
| Artifact Registry API | https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=crud-hackathon-ml-20260703 |
| Firestore API | https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=crud-hackathon-ml-20260703 |
| Cloud Logging API | https://console.cloud.google.com/apis/library/logging.googleapis.com?project=crud-hackathon-ml-20260703 |
| Cloud Monitoring API | https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=crud-hackathon-ml-20260703 |
| Error Reporting API | https://console.cloud.google.com/apis/library/clouderrorreporting.googleapis.com?project=crud-hackathon-ml-20260703 |
| Cloud Trace API | https://console.cloud.google.com/apis/library/cloudtrace.googleapis.com?project=crud-hackathon-ml-20260703 |

## GitHub Actions

Te linki nie są częścią GCP, ale są punktem wejścia do deployu tej infrastruktury:

| Workflow | URL |
| --- | --- |
| Infra Bootstrap | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/infra-bootstrap.yml |
| `crud-backend` | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/crud-backend.yml |
| `crud-frontend` | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/crud-frontend.yml |
| `general-ai-agent` | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/general-ai-agent.yml |
| `customer-portal` | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/customer-portal.yml |
| `triz-mcp-server` | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/triz-mcp-server.yml |
| `research-landing` | https://github.com/syzygypl/rosellas-hackathon/actions/workflows/research-landing.yml |

Ustawione GitHub Actions variables:

- `GCP_PROJECT_ID=crud-hackathon-ml-20260703`
- `GCP_PROJECT_NUMBER=59918194944`
- `GCP_REGION=europe-west1`
- `WIF_PROVIDER=projects/59918194944/locations/global/workloadIdentityPools/github/providers/github`
- `GCP_SERVICE_ACCOUNT=github-deployer@crud-hackathon-ml-20260703.iam.gserviceaccount.com`
- `EMBEDDING_SERVICE_URL=https://api.openai.com/v1`
- `EMBEDDING_MODEL=text-embedding-3-small`

Ustawione GitHub Actions secrets:

- `EMBEDDING_API_KEY` dla workflowu `triz-mcp-server`
