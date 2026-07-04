# Agent Entry Point

Before making changes in this repository, load the shared skill at [skills/start-development-session/SKILL.md](skills/start-development-session/SKILL.md).

Then read [skills/start-development-session/references/project-context.md](skills/start-development-session/references/project-context.md).

Keep project context centralized in `skills/start-development-session/`. If architecture, commands, deploy behavior, endpoints, or important paths change, update that skill and any directly affected docs.

Operational notes:

- Check `git status --short` before edits and preserve user changes.
- Current infrastructure and public URLs live in `docs/google-infra-links.md`.
- Root package scripts use Nx targets for `apps/examples/backend/` and `apps/examples/frontend/`.
- There are no dedicated test scripts right now; builds are the baseline verification.
