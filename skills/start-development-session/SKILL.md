---
name: start-development-session
description: Load the Rosellas Hackathon repository context before development work. Use when starting or resuming a coding session, onboarding an LLM to this repo, changing frontend/backend/docs/workflows/deploy configuration, or answering project-structure questions that require the local architecture, commands, API surface, Cloud Run deployment notes, and verification expectations.
---

# Start Development Session

## Overview

Use this skill to establish the project baseline before doing work in this repository. This directory is the canonical, tool-neutral skill location for Codex, Cursor, Claude, and other LLM agents.

## Workflow

1. Read `references/project-context.md` from this skill directory.
2. Run or inspect `git status --short` before edits and preserve user changes.
3. If the task involves deployed resources, public URLs, Cloud Run revisions, GCP console links, or GitHub Actions workflow links, read `docs/google-infra-links.md`.
4. If the task changes architecture, commands, endpoints, deployment behavior, or important paths, update `references/project-context.md` and any affected entrypoint docs.

## Scope Hints

- Frontend work usually starts in `apps/examples/frontend/src/app/`.
- Backend work usually starts in `apps/examples/backend/src/`.
- Deployment work usually starts in `.github/workflows/`, `apps/examples/backend/Dockerfile`, `apps/examples/frontend/Dockerfile`, or `docs/google-infra-links.md`.
- New application work should also read `skills/add-new-application/SKILL.md`.
- Design system or Figma generator work should also read `skills/generate-figma-design-system/SKILL.md`.
- Versioning changes should also read `docs/versioning/README.md`.
- Cross-service API changes must keep backend DTO/service code and frontend model/service code aligned.

Do not perform live GitHub or GCP operations unless the user asks for live validation or deployment.
