# Adv360 theme system research and prototype

**Scope:** theme research and a file://-runnable board-first prototype. No files in the product or keyboard repositories were changed.

## Research findings

### Ghostty

Ghostty theme files are small `key = value` config files. For color themes the central fields are `background`, `foreground`, `cursor-color`, `selection-background`, `selection-foreground`, and repeatable `palette = 0=#...` through `palette = 15=#...`. A theme may also change other Ghostty configuration values, so an importer should extract only recognized color keys and never apply a pasted file as configuration.

Ghostty documents built-in themes as coming from `mbadolato/iTerm2-Color-Schemes`, synced into its resources weekly. Its built-in picker is `ghostty +list-themes`: in a TTY it opens a browsable preview; piped output is a plain theme list. The local implementation documents two search locations, XDG user themes at `$XDG_CONFIG_HOME/ghostty/themes` and packaged resources; local source is [Ghostty `src/config/theme.zig`](/Users/ali/github/ghostty/src/config/theme.zig) and the CLI preview is [Ghostty `src/cli/list_themes.zig`](/Users/ali/github/ghostty/src/cli/list_themes.zig). Official details: [Ghostty Color Theme docs](https://ghostty.org/docs/features/theme).

`theme = dark:Catppuccin Frappe,light:Catppuccin Latte` pairs distinct files and switches with the desktop appearance. Theme files can also be absolute paths; Ghostty searches its user theme directory before bundled resources. A file can contain non-color options, which is why the web importer below deliberately reads only color fields.

**License verdict:** the iTerm2-Color-Schemes collection has an MIT license, but its own license text explicitly says individual theme rights belong to each author. Its [license index](https://github.com/mbadolato/iTerm2-Color-Schemes/blob/master/licenses.yml) identifies some palettes as MIT or Apache-2.0, and leaves others `unknown` or `nonfree`. So the collection MIT license is not a blanket grant for every palette. Redistribute palettes only after checking their individual entry and preserving all required license notices and attribution. In this sampled set, 40 of 54 Ghostty files are marked MIT or Apache-2.0; 14 are `unknown`. The prototype keeps those 14 only to exercise the picker and flags their status in the generated catalog. Do not ship those entries without clearing them. The research snapshot is [license-audit.json](sources/license-audit.json).

### OpenCode

The older/currently documented TUI JSON format requested for this design has optional `defs` for reusable named colors and a `theme` object of semantic keys (`primary`, `text`, `background`, `diffAdded`, etc.). A semantic value can be a plain color or a `{ "dark": ..., "light": ... }` pair; definitions may be referenced by name. It accepts hex values, ANSI indexes, `none`, and references. Custom JSON files are loaded from global `~/.config/opencode/themes/*.json` and project `.opencode/themes/*.json`; closer project scope wins on a name collision. The `/theme` picker previews/selects themes, and the `system` theme derives colors from terminal background/foreground/ANSI values. See the [OpenCode themes docs](https://docs.opencode.ai/docs/themes/) and the [OpenCode theme picker docs](https://dev.opencode.ai/v2/docs/cli/theme/).

OpenCode is evolving its schema: its v2 docs describe complete `base` token trees plus mode palettes and overrides, and the current CLI names its quick selector `/themes`. The stable design lesson is the separation of semantic roles from raw palette values, paired with mode-aware inheritance; the prototype import path implements the requested `defs` + semantic-key form, not every V2 `base`/`hue` feature.

### Useful picker pattern

Both products make browsing an actual preview step: Ghostty renders the palette in its TUI preview; OpenCode exposes theme selection and a terminal-derived system option. The prototype uses a searchable catalog where arrow navigation immediately changes the board, Enter applies, Escape reverts, and favorites/mode filters reduce the list.

## Token contract

| Group | Tokens |
|---|---|
| Workspace surfaces | `surface-canvas`, `surface-panel`, `surface-raised`, `surface-hover`, `surface-glow`, `surface-dot` |
| Text and boundaries | `text-primary`, `text-secondary`, `text-muted`, `border-base`, `border-subtle`, `focus-ring` |
| Keycaps | `keycap-top`, `keycap-face`, `keycap-side`, `keycap-highlight`, `keycap-legend`, `keycap-sublegend`, `keycap-shadow` |
| Four layer identities | `layer-1` through `layer-4` |
| Binding and arc identities | `arc-holdtap`, `arc-macro`, `arc-bluetooth`, `arc-combo` |
| Status and diff | `status-warning`, `status-error`, `status-success`, `status-info`, `diff-add`, `diff-remove`, `diff-add-bg`, `diff-remove-bg` |
| Contrast helpers | `accent-primary`, `on-accent`, `on-warning`, `on-success`, `on-combo`, `on-layer-1` through `on-layer-4` |
| Depth | `overlay`, `shadow-ink`, `shadow-dialog`, `shadow-float` |

### Ghostty palette to token mapping

This is the deterministic seed mapping used by the prototype. For any missing palette entry, substitute `foreground` (or the listed fallback); never introduce an arbitrary fixed theme color.

| Input | Derived tokens |
|---|---|
| `background`, `foreground` | canvas and legibility baseline; infer light/dark from relative luminance of background |
| `background` mixed with `foreground` | panel, raised, hover, keycap face/top/side, subtle border; the mix percentage differs by inferred mode |
| `foreground` | primary text and key legends; derive muted/sublegend from a mix with the face, then contrast-correct |
| ANSI `[4, 2, 3, 5]` | `layer-1..4` (blue, green, yellow, magenta), hue-preserving contrast correction against canvas |
| ANSI `[1, 1, 2, 6, 5, 4, 5]` | warning, error, success, info, hold-tap, Bluetooth, macro; `arc-combo` uses ANSI 13 (fallback 5) |
| `cursor-color` | focus ring (fallback ANSI 4, then foreground) |
| `selection-background` | soft workspace glow; retain translucency so it does not compete with text |
| ANSI 2 / ANSI 1 | diff-added / diff-removed; mix each with canvas for low-alpha backgrounds |

`ensureContrast(foreground, background, threshold)` measures WCAG relative luminance, then mixes the foreground toward whichever of black or white can meet the target with the smaller adjustment. Apply it after hand-tuned overrides as well as palette mapping:

- key legends: **4.5:1 minimum** against keycap face;
- sublegends and small muted labels: **3:1 minimum**;
- colored UI glyphs, layer markers, focus/status accents: **3:1 minimum** against their adjacent surface;
- active foregrounds choose black or white independently per accent, instead of assuming white works for every palette.

The headless audit checked all 57 prototype themes (both modes for semantic JSON themes): minimum key legend **4.51:1**, sublegend **3.00:1**, and layer glyph **3.15:1**. None failed those thresholds. The check is in `window.themeSystem.contrastAudit()` and `window.themeSystem` exposes computed tokens for review.

## OpenCode-style overrides and imports

A custom JSON theme can override the semantic roles above, plus the editor-specific roles such as `keycapFace`, `layer1`, `arcCombo`, `diffAddBg`, and `focusRing`. Resolve `defs` references first, then select the active dark/light variant, then apply token overrides, then run contrast correction. Unknown keys should be reported at import time instead of silently written into CSS.

Ghostty paste import should parse only the color fields and ANSI slots and ignore the rest. OpenCode JSON import should validate shape and color syntax before storing. The prototype accepts these imports in memory and stores imported themes/favorites/choice in local storage where the origin permits it. For the real app, persist custom theme JSON locally per authenticated user; do not write themes into `.keymap` or any firmware files.

## Real app recommendation (TanStack Start + Tailwind v4)

- Put a curated, license-cleared preset catalog in `src/themes/catalog.json`; keep source palette values, theme id/name, provenance, author/license/source URL, light/dark pair id, and a small schema version. Put the deterministic mapper and contrast utilities in `src/themes/resolve.ts`; keep user-created themes in a separate preferences record, not in the bundled preset JSON.
- Load the catalog on first picker open with a dynamic import. Current prototype catalog: 31,970 bytes raw / 6,688 gzip for 54 terminal palettes plus 3 semantic examples; the 40 MIT/Apache palettes are 21,298 bytes raw / 4,445 gzip before attribution/license text. The production chunk should be about this size or smaller. Do not bundle the upstream 771-file set wholesale; add future palettes only after license review.
- Keep runtime color properties as ordinary custom properties on `<html data-theme="light|dark">`. For shared layouts, map them to Tailwind v4 utilities with `@theme inline { --color-canvas: var(--surface-canvas); --color-keycap: var(--keycap-face); --color-layer-1: var(--layer-1); ... }`. Tailwind documents `@theme` as the utility-generation contract and recommends `inline` when a theme variable references another CSS variable, so generated utilities read the live value from the theme root. Keep one-off tokens as ordinary CSS variables.
- Avoid the wrong-theme flash by SSR-rendering the selected theme's `data-theme` and resolved CSS variables from a small preference cookie (`themeId`, mode, last effective light/dark mode). Run a small `ScriptOnce` in `<head>` before hydration to resolve `system` with `prefers-color-scheme` and switch to the matching paired palette before paint; for first visits with no cookie, keep light/dark CSS fallbacks under `prefers-color-scheme`. If user themes live only in local storage, either mirror the active id/mode to a cookie or store the resolved token map so the early script can apply it without waiting for the lazily loaded picker catalog. Use the same cookie-resolved values for SSR markup and hydration. TanStack Router documents `ScriptOnce` for theme detection before hydration; Start SSRs matched routes by default.
- Persist `{ themeId, mode: 'system'|'dark'|'light', favorites, customThemes }` in local storage for this single-user app; optionally mirror just `themeId` and `mode` in a small cookie so SSR can pick the first paint. Listen to `matchMedia` changes only when mode is `system`. Applying/reverting a picker preview should not persist until Enter/Use theme.
- The upstream token set should remain the API for components. Tailwind classes express layout and spacing; CSS variables express the runtime theme. This lets the keyboard canvas, binding popovers, validator, combo arcs, and review diff use the same theme without one-off colors.

References: [Tailwind theme variables](https://tailwindcss.com/docs/theme), [TanStack Router `ScriptOnce`](https://tanstack.com/router/latest/docs/guide/document-head-management), [TanStack Start SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr).

## Prototype and verification

- Prototype: `prototype/index.html` (self-contained CSS/JS, loads with `file://`; no network fonts/assets).
- Generator: `scripts/generate_presets.py` (reads actual Ghostty theme files and the selected license audit snapshot).
- Theme palette and provenance/license snapshot: `sources/license-audit.json`.
- Screenshots: `screens/catppuccin-mocha.png`, `screens/catppuccin-latte.png`, `screens/kanagawa-wave.png`, `screens/harbor-signal.png`, and `screens/theme-picker.png`.

The prototype was opened using `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless` at 1440×1024. All inline scripts passed `node --check`; Chrome's DOM audit reported 55/55 color themes passing the documented contrast thresholds. macOS printed headless `CVDisplayLink` and task-policy diagnostics, but Chrome wrote the screenshots successfully.
