# Key and behavior catalog

The picker catalog targets ReFil ZMK revision [`adv360-z3.5-2`](https://github.com/ReFil/zmk/tree/adv360-z3.5-2). The vendored `keys.h` defines 644 key names across 373 HID usages. `scripts/build-keycodes.ts` reads those definitions, computes usage values, groups aliases by usage, and generates a human label for every spelling from its header comment when available or from its identifier otherwise. `src/lib/keycodes/catalog.ts` applies the curated overlay for common labels, aliases, search terms, glyphs, groups, and friendly shortcuts.

The behavior inventory and binding-cell counts are recorded in [`behavior-bindings.json`](../vendor/zmk/adv360-z3.5-2/behavior-bindings.json) from this firmware revision's `app/dts/behaviors.dtsi`. Mouse parameters are taken from the vendored headers:

| Behavior | Picker examples                   | Source constants                                                                     |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `&mkp`   | `&mkp LCLK`, `&mkp MB4`           | `LCLK`, `RCLK`, `MCLK`, `MB4`, `MB5` in `pointing.h`                                 |
| `&mmv`   | `&mmv MOVE_UP`, `&mmv MOVE_LEFT`  | `MOVE_UP`, `MOVE_DOWN`, `MOVE_LEFT`, `MOVE_RIGHT`, `MOVE(hor, vert)` in `pointing.h` |
| `&msc`   | `&msc SCRL_UP`, `&msc SCRL_RIGHT` | `SCRL_UP`, `SCRL_DOWN`, `SCRL_LEFT`, `SCRL_RIGHT` in `pointing.h`                    |

The picker only offers behaviors present in that firmware manifest. `&mkp`, `&mmv`, and `&msc` are available in this revision; the menu uses the parameter macros defined by its headers. Built-in action rows provide a useful fixed binding and legends use the matching behavior and parameters. User-defined behaviors continue to be available through the raw binding field.

## User headers and unknown key names

When a config file includes a local header, the resolver reads that header if its contents are present in the supplied file map. It follows nested local includes too, and collects object-like definitions written as `#define NAME VALUE`. The picker adds each name as a custom key row; a nearby C comment supplies its label when present, otherwise the name is humanized. The original macro value and source file appear as row context. This supports generated locale headers such as `german_aliases.h` without evaluating or expanding C macros.

If a key name is not in the built-in catalog or a supplied header, the raw binding field still accepts it when it is a valid identifier, preserves it verbatim, and shows a warning to check the included headers. Unsupported characters or malformed bindings remain visible as validation errors rather than disappearing.

## Search ranking

- Friendly shortcuts and curated everyday keys rank ahead of raw HID-only usages for natural-language queries.
- Exact labels, code names, and aliases rank ahead of word-start and fuzzy matches. Keywords provide a lower-confidence match.
- Fuzzy subsequences need reasonable character density; scattered matches are discarded.
- Uncurated consumer-page and out-of-range HID usages receive a lower base weight and display `HID key, may not work on macOS/Windows`. Curated media and international keys retain normal priority.
- Query order is covered for `copy`, `paste`, `vol up`, `play`, `mute`, `bright`, `globe`, `kana`, `fn`, `prtsc`, and `del` in `tests/picker/fuzzy.test.ts`.
