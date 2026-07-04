# Idealab Design System

Shared, framework-agnostic CSS design system consumed by every Idealab app
(`customer-portal`, `landing-page`). Pure CSS — no build step, no framework
coupling.

## Structure

| File | Contents |
| --- | --- |
| `src/tokens.css` | Design tokens on `:root` — the only place visual decisions live |
| `src/base.css` | Minimal global reset (`html/body`, form-control font inheritance) |
| `src/primitives.css` | Reusable classes: `.label`, `.btn` / `.btn-lg`, `.pill`, focus ring |
| `src/index.css` | Single entry point importing all of the above |

## Consuming the system

Each app pulls the entry point in via the `styles` array of its `angular.json`:

```json
"styles": ["../../libs/design-system/src/index.css", "src/styles.css"]
```

App and component styles must reference **tokens only** — no raw hex colors,
px spacings, radii or shadows outside `tokens.css`.

## Tokens

- **Color** — semantic roles, not raw values: neutrals (`--color-bg`,
  `--color-surface`, `--color-ink`, `--color-body`, `--color-muted`,
  `--color-border`), primary action (`--color-primary`, `--color-on-primary`),
  accent (`--color-accent*`), status (`--color-warning*`, `--color-error`,
  `--color-busy`), tags & code.
- **Typography** — families (`--font-sans` Inter, `--font-serif` Georgia,
  `--font-mono`), an 8-step text scale (`--text-2xs` … `--text-2xl`) plus
  display sizes for marketing pages (`--text-display-1..3`), weights
  (`--weight-regular` … `--weight-heavy`) and rhythm
  (`--leading-*`, `--tracking-wide`).
- **Spacing** — a 2px-base scale, `--space-2` … `--space-96`.
- **Radii** — `--radius-sm` (4) / `--radius-md` (8) / `--radius-lg` (12) /
  `--radius-full` (pill).
- **Shadows** — elevation levels `--shadow-sm/md/lg` plus `--shadow-primary`
  for dark action surfaces.
- **Focus** — `--focus-ring`, applied globally via `:focus-visible`.

## Primitives

- `.label` — uppercase micro-label (eyebrows, section headings, badges, status
  chips). Compose with app classes: `<p class="label eyebrow">`.
- `.btn` — dark primary action (button or link); `.btn-lg` size variant.
- `.pill` — interactive pill/chip with dark hover inversion.
- `:is(a, button):focus-visible` — accent focus ring on every interactive
  element.
