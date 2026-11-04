# Theme contract

The following CSS variables are available on `html`:

`--surface-canvas`, `--surface-panel`, `--surface-raised`, `--surface-hover`, `--surface-glow`, `--surface-dot`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-base`, `--border-subtle`, `--focus-ring`, `--keycap-top`, `--keycap-face`, `--keycap-side`, `--keycap-highlight`, `--keycap-legend`, `--keycap-sublegend`, `--keycap-shadow`, `--layer-1`, `--layer-2`, `--layer-3`, `--layer-4`, `--arc-holdtap`, `--arc-macro`, `--arc-bluetooth`, `--arc-combo`, `--status-warning`, `--status-error`, `--status-success`, `--status-info`, `--diff-add`, `--diff-remove`, `--diff-add-bg`, `--diff-remove-bg`, `--accent-primary`, `--on-accent`, `--on-warning`, `--on-success`, `--on-combo`, `--on-layer-1`, `--on-layer-2`, `--on-layer-3`, `--on-layer-4`, `--overlay`, `--shadow-ink`, `--shadow-dialog`, `--shadow-float`.

Tailwind color utilities (usable with `bg-`, `text-`, `border-`, etc.): `canvas`, `surface`, `raised`, `hover`, `legend`, `sublegend`, `primary`, `secondary`, `muted`, `subtle`, `keycap`, `accent-layer-1`, `accent-layer-2`, `accent-layer-3`, `accent-layer-4`. For example: `bg-surface`, `bg-canvas`, `text-legend`, `text-sublegend`, `border-subtle`, `bg-keycap`, and `text-accent-layer-1` through `text-accent-layer-4`.

## Storage

The `theme-preference` cookie contains a version, mode, light and dark theme IDs, and, when the effective theme is custom, a short fingerprint of its definition. Imported definitions and their precomputed light and dark tokens are stored in the browser's `theme-custom` localStorage entry, not in the cookie. The server renders preset variables; for a custom selection it renders the default preset, then a pre-paint script applies the locally stored tokens only when the definition matches the cookie fingerprint. If the definition is missing, invalid, or changed, hydration selects the default preset and repairs the cookie. Storage access can fail in restricted browser contexts; the default remains available. Custom themes are local to the browser and are not synchronized across devices.
