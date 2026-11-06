# Keyboard profiles

Profiles keep repository, keymap, target, layout, and build details outside the ZMK semantic
model. `src/lib/profile/registry.ts` exports a versioned registry and the Advantage360 Pro is its
first entry. A profile is explicit: the editor does not guess which keymap or layout a repository
intends to use.

`KeyboardProfile` includes the repository owner/name and branch, config root, exact keymap path,
whether the keymap is shared across build parts, board/shield/parts, selected layout source/path
and identity, expected key count and verification state, and workflow/build artifact mapping.
Optional sensor metadata describes the separate sensor count and labels. The registry uses a small
hand-written validator with field-path diagnostics so malformed profile data can be rejected
without adding a schema dependency.

The Advantage360 profile points to `ali-aljufairi/Adv360-Pro-ZMK` on `V3.0`, uses
`config/adv360.keymap`, and selects the `physical_layout0` DTS node from
`config/boards/arm/adv360/adv360-layouts.dtsi`. Its custom workflow is
`.github/workflows/build.yml`; the two outputs are `firmware-clique` and
`firmware-no-clique`. The profile keeps `adv360_left` and `adv360_right` as separate build parts
for a shared logical keymap.

Use `createEditorForProfile(profile, files)` to resolve the profile's keymap and layout. The
editor exposes `profileId`, `profile`, and the selected `layout`. Existing callers can continue to
use `createEditor(files, entry)` without a profile. Both entry points operate on supplied source
files; profile support does not fetch repositories or execute build workflows.

The layout adapters currently support QMK-style `info.json` and explicit ZMK
`zmk,physical-layout` DTS nodes. DTS parsing uses the lossless tokenizer/CST and deliberately does
not evaluate preprocessor branches. Profiles select a DTS node by label or layout name when a
file has multiple nodes. Other profile source values (`keymap-drawer`, `kle`, and `manual`) are
reserved for future adapters.

## Adv360 geometry comparison

The fixture's QMK-style `info.json` `LAYOUT` and ZMK `physical_layout0` both have 76 entries in
the same order. Comparing each ordered entry's `x`, `y`, `w`, `h`, rotation, and rotation origin
(`rx`, `ry`) after converting DTS centi-key values to key units gives identical geometry. JSON-only
labels and row/column coordinates have no equivalent in the DTS key tuples; the DTS geometry does
not replace the matrix transform, and the info.json label at index 35 (`LCtrl`) is stale relative
to layer 0's `LEFT_ALT` binding. The parser preserves the JSON label for the existing informational
diagnostic; it does not infer logical positions from row/column coordinates.

## Validation

`validate(model, { physicalLayout })` checks binding counts and combo positions against the
selected physical layout. Callers can also pass `expectedKeyCount` and `expectedKeyPositions`
directly. With no layout supplied, validation still requires every layer to have the same number
of bindings, but imposes no board-specific count and does not range-check combo positions against
an invented layout. Layer `sensor-bindings`, when present, are available as raw read-only
`sensorBindings` text and remain intact in the original source during edits.
