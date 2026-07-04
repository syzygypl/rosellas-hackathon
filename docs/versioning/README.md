# Application Versioning

This repository uses one shared application version and per-build metadata for all example apps.

## Source of Truth

- `package.json` `version` is the shared human-readable application version.
- `GITHUB_SHA` is the immutable build commit in GitHub Actions.
- `BUILD_TIME` is generated during the CI build as a UTC ISO timestamp.
- Local development can use `local` values when CI metadata is not available.

Do not introduce per-application package versions under `apps/examples/`. The Nx workspace has one root `package.json` and one root `package-lock.json`.

## Backend Pattern

Backend apps should expose build metadata through an API endpoint and Swagger.

Use this environment contract:

| Variable | Purpose |
| --- | --- |
| `APP_VERSION` | Shared app version from root `package.json`. |
| `GIT_SHA` | Commit SHA for the deployed build. |
| `BUILD_TIME` | UTC ISO timestamp for the deployed build. |

For a NestJS backend:

- Add a version DTO documented with `@nestjs/swagger`.
- Add `GET /api/version` that returns `version`, `commitSha`, and `buildTime`.
- Register the version controller in the app module.
- Set Swagger `.setVersion(process.env.APP_VERSION ?? 'local')`.
- Keep local fallback values deterministic enough for development.

The example backend implementation lives in:

- `apps/examples/backend/src/version.dto.ts`
- `apps/examples/backend/src/version.controller.ts`
- `apps/examples/backend/src/main.ts`

## Frontend Pattern

Frontend apps should display their own build metadata and, when paired with a backend, the backend metadata.

For Angular:

- Keep `appVersion`, `buildSha`, and `buildTime` in the environment files.
- Use `local` defaults in `environment.ts` and `environment.prod.ts`.
- In CI, rewrite or generate the production environment before the Nx build.
- Fetch backend metadata from `<apiUrl>/version` and show a graceful unavailable state if the backend does not answer.
- Keep version UI compact; it should not compete with the main workflow.

The example frontend implementation lives in:

- `apps/examples/frontend/src/environments/`
- `apps/examples/frontend/src/app/models/version.model.ts`
- `apps/examples/frontend/src/app/services/version.service.ts`
- `apps/examples/frontend/src/app/app.component.*`

## Workflow Pattern

GitHub Actions must compute build metadata before the Nx build, outside Docker.

Backend deploys:

- Resolve `APP_VERSION` from `node -p "require('./package.json').version"`.
- Resolve `BUILD_TIME` from `date -u +"%Y-%m-%dT%H:%M:%SZ"`.
- Build through Nx before Docker packaging.
- Pass `APP_VERSION`, `GIT_SHA`, and `BUILD_TIME` to Cloud Run with `--set-env-vars`.
- Docker should copy the prebuilt backend artifact from `apps/examples/<backend>/dist`.

Frontend deploys:

- Resolve the deployed backend URL first.
- Resolve `APP_VERSION` and `BUILD_TIME` before the Angular production build.
- Generate the production environment with `apiUrl`, `appVersion`, `buildSha`, and `buildTime`.
- Build through Nx before Docker packaging.
- Docker should copy the prebuilt frontend artifact from `dist`.

## Adding New Applications

When adding a new app under `apps/examples/`, apply this checklist:

1. Keep dependency ownership at the repository root.
2. Add an Nx `project.json` with build outputs that match the Dockerfile copy paths.
3. Build the app through Nx before Docker packaging in CI.
4. Add the version display or endpoint before the first deploy workflow lands.
5. Document any new public endpoints and deploy behavior in `skills/start-development-session/references/project-context.md`.
6. Use `skills/add-new-application/SKILL.md` for the full app-addition workflow.

## Verification

Use the narrowest build that covers the change:

```bash
npm run build:backend
npm run build:frontend
npm run build
```

For backend versioning changes, also verify:

```bash
curl -sS http://localhost:8080/api/version
curl -sSI http://localhost:8080/api/docs
```
