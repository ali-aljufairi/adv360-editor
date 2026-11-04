# adv360-editor

A visual keymap editor for the Kinesis Advantage360 Pro (ZMK), built for
[ali-aljufairi/Adv360-Pro-ZMK](https://github.com/ali-aljufairi/Adv360-Pro-ZMK).

Status: early development. See [docs/PRODUCT.md](docs/PRODUCT.md).

## Acknowledgements

Inspired by Nick Coutsos's [Keymap Editor](https://github.com/nickcoutsos/keymap-editor)
(MIT License). Any code adapted from that project retains its original copyright notice.

`fixtures/adv360/` contains a copy of the Adv360-Pro-ZMK configuration (MIT, Kinesis
Corporation and contributors) used for round-trip tests.

## Parser gate

`pnpm install`, `pnpm test`, `pnpm typecheck`, and `pnpm build` run the local gate. The single route displays fixture layer names; Nitro and `vercel.json` configure a Vercel deployment without deploying it.

The browser-safe `src/lib/zmk` module exposes `tokenize(source, file?)`, `parse(source, file?)`, `serialize(cst)`, `resolve(files, entry)`, `validate(model)`, `loadPhysicalLayout(info, name?)`, `diff(before, after)`, and `createEditor(files, entry)`. A `ZmkEditor` exposes `model`, `setBinding(layerIndex, keyIndex, binding)`, `updateHoldTapProperty(name, property, value)`, `addMacro(rawNode, container?, file?)`, `updateMacro(name, rawNode)`, `removeMacro(name)`, `addCombo(rawNode)`, `updateCombo(name, rawNode)`, `removeCombo(name)`, `addLayer(rawNode)`, `removeLayer(index)`, `renameLayer(index, name)`, `serialize()` and `diff()`. Node add/update methods accept complete devicetree node text; property values include their devicetree delimiters. For an included fragment with no enclosing node, `addMacro` can append to an explicit existing file. Edits are applied immediately and spans are refreshed on the next model access.

Offsets are UTF-16 string offsets. The CST retains the original token stream, including opaque directives, comments, and unrecognized syntax. Include resolution follows quoted paths present in the supplied virtual map; missing quoted paths are listed in `model.missingIncludes`. Angle-bracket includes and preprocessor expansion are not resolved. Conditions are recorded symbolically, not evaluated; consequently diagnostics are conservative across conditional branches and cannot prove behavior definitions supplied by external ZMK includes. The fixture references a generated `version.dtsi` that is not provided, so `&macro_ver` cannot be resolved from the fixture alone. Layer reachability uses numeric targets and models layer-switch bindings as directed edges; it does not simulate runtime layer stacks or preprocessor evaluation. Removing or renaming a layer does not rewrite numeric references to layers.
