---
name: generate-figma-design-system
description: Generate, validate, and import the repository-driven Rosellas Idealab Figma design system. Use when changing design tokens, UI kit component metadata, the Figma generator app, local Figma plugin artifacts, or user-facing instructions for importing the generated design system into Figma.
---

# Generate Figma Design System

## Overview

Use this skill to keep the repository-owned design system and the local Figma
plugin flow consistent.

The design system is source-controlled in the repository. The generated files in
`dist/apps/figma-generator/figma-plugin/` are temporary build artifacts used by
Figma Desktop to run a local plugin.

## Required Context

1. Read `skills/start-development-session/SKILL.md`.
2. Read `skills/start-development-session/references/project-context.md`.
3. Run or inspect `git status --short` before editing and preserve unrelated user changes.
4. Inspect only the design-system paths needed for the task.

## Source Files

- `design-system/tokens/rosellas.tokens.json`: source of truth for Figma Variables.
- `design-system/figma/ui-kit.json`: source of truth for the generated Figma UI kit structure.
- `tools/design-system/build-figma-plugin.mjs`: builds the local Figma plugin.
- `tools/design-system/validate-design-system.mjs`: validates token and UI kit metadata.
- `apps/figma-generator/project.json`: Nx wrapper around validation and plugin build targets.
- `.github/workflows/design-system.yml`: CI validation and plugin artifact workflow.

## Local Commands

Validate metadata:

```bash
npm run design-system:validate
```

Build the local Figma plugin:

```bash
npm run design-system:figma:plugin:build
```

Equivalent Nx target:

```bash
npx nx run figma-generator:build
```

The build writes:

```text
dist/apps/figma-generator/figma-plugin/manifest.json
dist/apps/figma-generator/figma-plugin/main.generated.js
dist/apps/figma-generator/figma-plugin/README.md
```

Do not commit `dist/`; it is a generated import artifact.

## Figma Import

Local `manifest.json` import requires **Figma Desktop**. Browser-only Figma
cannot import a local plugin manifest because it cannot read plugin files from
the local disk.

In Figma Desktop:

1. Open a Figma Design file.
2. Run `npm run design-system:figma:plugin:build` from the repository root.
3. In Figma, open plugin development import:
   `Plugins -> Development -> Import plugin from manifest...`
4. Select:

```text
<repo-root>/dist/apps/figma-generator/figma-plugin/manifest.json
```

5. Run the plugin:

```text
Plugins -> Development -> Rosellas Idealab Tokens
```

The plugin creates or updates Variables, text styles, and component sets. It
uses one `Rosellas · Design System` page with sections so it works in Figma
files limited to three pages.

After the plugin finishes, it selects the generated `Repository Components`
frame. Component sets are also available as local components in the Assets panel.

## Troubleshooting

- If Figma reports a page limit error, rebuild and rerun the latest plugin. The
  current generator must not call `figma.createPage()`.
- If the canvas looks blank or dark, press `Shift + 1` in Figma to zoom to
  content and look for the `Rosellas · Design System` page.
- If Figma shows `Design system sync failed: ...`, use the exact notification
  text to debug the generator.
- If `Plugins -> Development` is missing, confirm the file is open in Figma
  Desktop, not browser Figma, FigJam, Slides, Make, dashboard, or Dev Mode.
- If a local manifest was already imported from the same path, rebuild locally
  and run the existing development plugin again; re-import is usually not needed.

## Change Guidelines

- Keep source data in `design-system/`; avoid editing generated files in `dist/`.
- Keep the free local plugin path free of Figma Enterprise REST API requirements.
- Keep the plugin single-page unless the project explicitly moves to a Figma
  plan/workspace without page limits.
- Update `README.md`, `design-system/README.md`, `apps/figma-generator/README.md`,
  and project context when commands, artifact paths, import steps, or generated
  Figma behavior change.

## Verification

Run the narrowest useful checks:

```bash
npm run design-system:validate
npm run design-system:figma:plugin:build
node --check tools/design-system/build-figma-plugin.mjs
node --check tools/design-system/validate-design-system.mjs
node --check dist/apps/figma-generator/figma-plugin/main.generated.js
```

Static checks cannot prove the plugin runs inside Figma; user validation in
Figma Desktop is still required for canvas output.
