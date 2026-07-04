# Figma Generator

Nx project wrapper for the repository-driven Rosellas Idealab Figma generator.

The source of truth remains in:

- `design-system/tokens/rosellas.tokens.json`
- `design-system/figma/ui-kit.json`
- `tools/design-system/`

Targets:

```bash
nx run figma-generator:validate
nx run figma-generator:build
```

`build` generates the local Figma plugin in `dist/apps/figma-generator/figma-plugin/`.
When the plugin runs in Figma, it uses one `Rosellas · Design System` page and
selects the generated `Repository Components` frame so the generated component
sets are immediately visible.

Import flow:

1. Open a Figma Design file in Figma Desktop.
2. Run `npm run design-system:figma:plugin:build`.
3. Import `dist/apps/figma-generator/figma-plugin/manifest.json` through
   Plugins -> Development -> Import plugin from manifest.
4. Run `Rosellas Idealab Tokens`.

Browser Figma cannot import the local manifest. Use
`skills/generate-figma-design-system/SKILL.md` for the full agent workflow.
