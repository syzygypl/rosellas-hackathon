# Rosellas Idealab Design System

This directory is the repository source of truth for the Rosellas Idealab mini design system.

## Scope

The first version is intentionally small:

- Foundations: color, typography, spacing, radius, and shadow tokens.
- Components: logo, button, badge, chip, card, track card, section heading, header, and footer.
- Patterns: hero section, track grid, CTA section, research workspace header, empty state, and panel layout.
- Example screens: landing page and core research workspace views.

## Files

| Path | Purpose |
| --- | --- |
| `tokens/rosellas.tokens.json` | Repository-owned Figma Variables source. |
| `figma/ui-kit.json` | Single-page Figma UI kit/component/style manifest. |
| `../apps/design-system-showcase/` | Static Angular showcase for browser review of the design system, deployed as `design-system-showcase`. |
| `../dist/apps/figma-generator/figma-plugin/` | Generated local Figma plugin for the free manual sync path. |
| `../tools/design-system/` | Validation and local plugin build scripts. |
| `../.github/workflows/design-system.yml` | GitHub Actions workflow for validation and local plugin artifacts. |

## Figma Sync

### Free local plugin path

Build the plugin:

```bash
npm run design-system:figma:plugin:build
```

Then in Figma:

1. Open the target design file in **Figma Desktop**.
2. Go to Plugins -> Development -> Import plugin from manifest.
3. Select `dist/apps/figma-generator/figma-plugin/manifest.json`.
4. Run `Rosellas Idealab Tokens`.

Local manifest import is a Figma Desktop development flow. Browser Figma can run
published plugins, but it cannot import a local plugin manifest from this repo.

The plugin creates or updates Variables by collection and token name, creates
text styles from `figma/ui-kit.json`, scaffolds one `Rosellas · Design System`
page with sections, and generates component sets with variants for Logo, Button,
Badge, Card, Track Card, Section Heading, Header, and Footer. It does not
require a Figma Enterprise plan or a Figma REST API token.

The plugin does not create multiple Figma pages, so it works in files limited to
three pages. After it finishes, it selects the generated `Repository Components`
frame on the single design-system page. The component sets are also available as
local components in the Assets panel.

GitHub Actions also builds this plugin and uploads it as the
`rosellas-figma-plugin` artifact.

## Local Commands

```bash
npm run design-system:validate
npm run design-system:figma:plugin:build
npm run start:design-system-showcase
```

`design-system:validate` performs offline schema checks.
`design-system:figma:plugin:build` generates the local free plugin.
`start:design-system-showcase` runs the static browser showcase locally.
The deploy workflow maps the Cloud Run service to `desing.idealab.expert` after the domain is verified and DNS records are configured.

Agents changing this workflow should use
`skills/generate-figma-design-system/SKILL.md`.
