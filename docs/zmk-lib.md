# ZMK library

The tokenizer records every byte of source as a token with UTF-16 offsets. The parser builds a
concrete syntax tree (CST) over those tokens; `serialize(parse(source))` preserves the input. The
resolver follows quoted includes and builds layers, behaviors, macros and combos. The editor
applies patches to the original text and reparses after each edit. `diff` produces unified diffs.
Unknown syntax remains in the source rather than being regenerated.

```ts
import { createEditorForProfile, validate } from '../src/lib/zmk'
import { ADV360_PROFILE } from '../src/lib/profile'

const editor = createEditorForProfile(ADV360_PROFILE, files)
const issues = validate(editor.model, {
  physicalLayout: editor.layout?.keys,
})
editor.setBinding(0, 0, { behavior: 'kp', params: ['A'] })
editor.addCombo({ name: 'example', bindings: ['&kp ESC'], keyPositions: [0, 1] })
const changes = editor.diff()
const updatedFiles = editor.serialize()
```

`parse`, `tokenize`, `resolve`, `validate`, `loadPhysicalLayout`, `serialize`, and `diff` are
also available independently. `loadPhysicalLayout()` remains a backward-compatible helper that
returns QMK-style info.json keys. The layout-source adapters return a `PhysicalLayout` with keys,
layout name, source kind, and verification state. See [profiles](profiles.md) for the registry,
Advantage360 profile, DTS parser, and the `createEditorForProfile()` entry point. The editor
exposes structured `addCombo`, `updateCombo`,
`addMacro`, `updateMacro`, and `updateHoldTap` methods. Raw node operations are available as
`addComboRaw`, `updateComboRaw`, `addMacroRaw`, `updateMacroRaw`, and `addLayer`.
`removeLayer` and `moveLayer` return source spans, before and after text, and reasons for rewritten
references. Removal throws `LayerReferencedError` by default if the layer is referenced. Forced
removal replaces `&mo`, `&tog`, `&to`, and `&sl` references with `&none`, and replaces `&lt N X`
with `&kp X`. It removes the layer from combo layer lists, deleting combos with empty lists, and
deletes conditional-layer entries that reference it. Higher layer numbers are decremented.

Rewrites ignore comments and strings. Literal numeric binding and layer property references are
supported, as are binding symbols with a single numeric `#define` in the supplied files; those
rewrite the definition when renumbered. Undefined or ambiguous binding symbols raise
`UnresolvedLayerSymbolError`, and parenthesized layer expressions raise
`UnsupportedLayerExpressionError`, before any edits are applied. Preprocessor conditions are not
evaluated, and arithmetic and symbolic layer-property values are not resolved. The supplied
`version.dtsi` is empty in git; the config repository's `bin/get_version.sh` generates `macro_ver`
there during a build. The validator treats `macro_ver` as generated and reports an informational
note for its use. Pass `{ generatedBehaviors: [...] }` to `validate` to replace the default list.
Behavior labels in `boards/**/*.dtsi` in the supplied file map are also recognized.

## Real-world cases

`tests/zmk/issues.test.ts` checks every `fixtures/issues/*.keymap` for byte-exact no-op
round-tripping, semantic extraction, a same-width binding edit that changes only its target span,
and validator output without syntax errors. Cases synthesized because the issue did not include a
copyable source excerpt say so in the fixture header.

| Issue | Fixture | Expected behavior |
|---|---|---|
| [#37](https://github.com/nickcoutsos/keymap-editor/issues/37) | `37-inline-comment-spacing.keymap` | Keep the exact gap before an inline comment during unrelated edits. |
| [#103](https://github.com/nickcoutsos/keymap-editor/issues/103) | `103-define-as-binding.keymap` | Preserve `AS(Q)` as a raw binding with `editable: false`; reject structural edits to it. |
| [#198](https://github.com/nickcoutsos/keymap-editor/issues/198) | `198-local-includes.keymap` | Retain quoted includes at file scope and inside `behaviors`; missing include files do not block parsing. |
| [#147](https://github.com/nickcoutsos/keymap-editor/issues/147) | `147-ifdef-duplicate-layers.keymap` | Keep both preprocessor branches and repeated layer names as separate model entries. |
| [#39](https://github.com/nickcoutsos/keymap-editor/issues/39) | `39-addressed-node.keymap` | Keep `foo@123` as one addressed node name. |
| [#41](https://github.com/nickcoutsos/keymap-editor/issues/41) | `41-nested-spaced-functions.keymap` | Parse a nested spaced function as one parameter and retain its internal whitespace. |
| [#158](https://github.com/nickcoutsos/keymap-editor/issues/158) | `158-repeated-macro-placeholders.keymap` | Preserve every repeated `MACRO_PLACEHOLDER` and `macro_param_1to1` occurrence. |
| [#83](https://github.com/nickcoutsos/keymap-editor/issues/83) | `83-combo-all-layers.keymap` | An omitted `layers` property means all layers; selecting all layers removes the property. |
| [#77](https://github.com/nickcoutsos/keymap-editor/issues/77) | `77-hold-tap-parameters.keymap` | Preserve arbitrary mod-tap keycodes and custom hold-tap parameters, including zero. |
| [#119](https://github.com/nickcoutsos/keymap-editor/issues/119) | `119-parameterized-macro-placeholder.keymap` | Keep the parameter placeholder used by the video-only reproducer. |
| [#304](https://github.com/nickcoutsos/keymap-editor/issues/304) | `304-zero-valued-params.keymap` | Treat numeric `0` as a value, not as an absent parameter. |
| [#316](https://github.com/nickcoutsos/keymap-editor/issues/316) | `316-multi-param-behaviors.keymap` | Keep all parameters to multi-parameter Bluetooth bindings. |
| [#254](https://github.com/nickcoutsos/keymap-editor/issues/254) | `254-long-macro-sequences.keymap` | Stress a long behavior sequence; the issue describes preprocessor/comment handling but provides no sequence excerpt. |
| [#344](https://github.com/nickcoutsos/keymap-editor/issues/344) | `344-long-macro-sequences.keymap` | Preserve a long macro sequence without truncating its binding list. |
| [#64](https://github.com/nickcoutsos/keymap-editor/issues/64) | `64-conditional-layers.keymap` | Extract conditional-layer source/target references; the issue number no longer resolves, so the fixture is synthesized from the research note. |
| [#245](https://github.com/nickcoutsos/keymap-editor/issues/245) | `245-user-owned-header.keymap` | Keep the user-owned `ext_power.h` include. |
| [#292](https://github.com/nickcoutsos/keymap-editor/issues/292) | `292-version-sensitive-header.keymap` | Preserve one user-authored pointing header without reordering or duplication. |
| [#340](https://github.com/nickcoutsos/keymap-editor/issues/340) | `340-version-sensitive-header.keymap` | Preserve a version-sensitive header even when the selected ZMK revision may not support its behavior. |
| — | `crlf-line-endings.keymap` | Preserve CRLF bytes through parsing and edits. |
| — | `utf8-comments-unicode-behaviors.keymap` | Preserve UTF-8 comments and unicode behavior labels without offset corruption. |

The validator can receive `physicalLayout` from a layout source, or explicit
`expectedKeyCount`/`expectedKeyPositions`. Without a layout it checks only that all layers have a
consistent binding count. With an info.json layout it emits an informational
`info-label-mismatch` when a simple layer-0 keycode disagrees with the corresponding label. The
Adv360 metadata contains a known stale label at index 35 (`LCtrl` while layer 0 binds `LEFT_ALT`);
this is a note, not a validation error.
