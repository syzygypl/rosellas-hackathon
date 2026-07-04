# Claude Entry Point

Start every development session by reading the shared skill at [skills/start-development-session/SKILL.md](skills/start-development-session/SKILL.md), then read [skills/start-development-session/references/project-context.md](skills/start-development-session/references/project-context.md).

That skill directory is the canonical project context for architecture, commands, API paths, runtime configuration, deployment workflows, and verification expectations.

Keep changes aligned with the existing small Cloud Run demo:

- Angular frontend in `apps/examples/frontend/`.
- NestJS backend in `apps/examples/backend/`.
- Firestore `items` collection behind the backend only.
- GitHub Actions, Cloud Build, Artifact Registry, and Cloud Run for deploy.

If the task involves deployed resources or public links, also read [docs/google-infra-links.md](docs/google-infra-links.md).
