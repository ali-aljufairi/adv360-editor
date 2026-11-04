# ZMK library

The tokenizer records every byte of source as a token with UTF-16 offsets. The parser builds a
concrete syntax tree (CST) over those tokens; `serialize(parse(source))` preserves the input. The
resolver follows quoted includes and builds layers, behaviors, macros and combos. The editor
applies patches to the original text and reparses after each edit. `diff` produces unified diffs.
Unknown syntax remains in the source rather than being regenerated.

```ts
import { createEditor, resolve, validate } from '../src/lib/zmk'

const model = resolve(files, 'adv360.keymap')
const issues = validate(model)
const editor = createEditor(files, 'adv360.keymap')
editor.setBinding(0, 0, { behavior: 'kp', params: ['A'] })
editor.addCombo({ name: 'example', bindings: ['&kp ESC'], keyPositions: [0, 1] })
const changes = editor.diff()
const updatedFiles = editor.serialize()
```

`parse`, `tokenize`, `resolve`, `validate`, `loadPhysicalLayout`, `serialize`, and `diff` are
also available independently. The editor exposes structured `addCombo`, `updateCombo`,
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
