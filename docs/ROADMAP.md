# Roadmap

Owner: Ali Aljufairi. Product owner (agent): Claude Opus. Decisions are revisable; each is logged
in `docs/PRODUCT.md` → Decisions log.

## Team

| Role                              | Model                                          | Scope                                              |
| --------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Product owner                     | Claude Opus                                    | Briefs, review, integration, merges                |
| UI components                     | Claude Haiku (small tasks, < 100k tokens each) | React components, styling                          |
| Logic                             | GPT-6.1 Terra                                  | Parser, theme engine, state, server/GitHub         |
| Research + issue-driven hardening | GPT-6 Luna (max)                               | Items from `docs/research/keymap-editor-issues.md` |

## Reference material

- Approved UI + theme picker: `design/approved/board-first-themes.html` (open in a browser).
- Earlier concepts: `design/concepts/`.
- Theme research and license audit: `docs/research/themes/`.
- Upstream keymap-editor issue research: `docs/research/keymap-editor-issues.md`.
- Effect evaluation (rejected): `docs/research/effect-evaluation.md`.

## Known UI problems in the approved prototype (must fix in the real app)

1. Key legends overflow / truncate (e.g. "Keypac", "^Spac"). Legends must always fit the keycap:
   abbreviation table + font-size step-down + two-line wrap, never clipped.
2. The binding picker popover looks like a proof of concept. It must be minimal, searchable
   (fuzzy, keyboard-first, ⌘K-style), grouped by behavior, and polished.

## Milestones

### M1 — Foundations (parallel)

- **M1a Theme engine** (Terra): tokens, palette→token mapping, contrast checks, the 40
  license-cleared presets (+ hand-tuned), ThemeProvider, SSR without flash (cookie), persistence.
  Default: follow system → Catppuccin Mocha (dark) / Catppuccin Latte (light).
- **M1b Keycap + legend fitting** (Haiku): `Keycap` component and `fitLegend()` util with tests.
- **M1c Binding picker** (Haiku): searchable command-palette style picker component.
- **M1d Issue-driven parser hardening** (Luna): fixtures and fixes from the upstream issues.

### M1f — Multi-keyboard groundwork (after M1d lands; see `docs/research/multi-keyboard.md`)

- `KeyboardProfile` type (repo, branch, keymap path, board/shield target, layout source, workflow,
  artifact map); the Advantage360 is the first profile.
- Remove fixed 76-key assumptions; validate against the selected profile's layout.
- Layout-source interface (QMK info.json now; ZMK `zmk,physical-layout` DTS next).
- Thread a profile id through load / edit / commit / build. Multi-user stays out of scope.

### M1g — Key and behavior coverage (Luna, after M1f and picker polish)

Every key and behavior ZMK supports must be pickable, displayable and round-trippable. Driven by
upstream issues (see `docs/research/keymap-editor-issues.md`):

- Mouse: `&mkp`, `&mmv`, `&msc` with the parameter syntax of the firmware revision in use
  (#241, #283, #274, #228, #356).
- International: accents, currency, grave/tilde, locale headers such as zmk-locale-generator and
  `german_aliases.h`; names come from headers the config `#include`s (#230, #261, #263, #166,
  #219, #282).
- User-defined names from included `.h` files and any unlisted key code: accepted, shown as raw
  with a warning, never rejected silently (#222, #296).
- Missing keys/behaviors: Globe, media FF/rewind, all Delete variants, `&key_repeat`,
  `&soft_off`, `&studio_unlock`, `&caps_word`, `&sk`, `&kt`, `&gresc`, `&out`, `&ext_power`,
  `&bl`, `&rgb_ug`, `&sys_reset`, `&bootloader` (#143, #128, #217, #303, #209, #272).
- Picker usability regressions to guard against: typing shifted characters must not toggle
  modifiers, Enter confirms, focus stays in search, second-parameter slot gets focus
  (#113, #111, #155, #226).
- A coverage report test: every name in the vendored ZMK headers has a label or an explicit
  raw fallback; every built-in behavior has a picker entry and a legend.

### M2 — Board editor

- Board rendering from `info.json` + parser model, layer pills, key selection, picker integration,
  undo/redo, diff panel, validator problems panel, theme picker port.

### M3 — Behaviors

- Macro editor, hold-tap editor, combo editor (arcs on the board).

### M4 — GitHub

- GitHub App auth (single user), load config from repo, commit to branch, dispatch workflow,
  poll run for the exact commit, artifact links. Never flash.

### M5 — Next (from issue research)

- Copy/swap/batch assignment, accessibility pass, printable/PNG keymap export.
