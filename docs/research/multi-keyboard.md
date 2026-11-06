# Multiple keyboards: feasibility and effort

**Research date:** 2026-11-05  
**Verdict:** Yes. Supporting several of Ali’s keyboards is a manageable **medium** project if profiles are explicit and the app stays single-user. Supporting arbitrary ZMK keyboards adds meaningful layout and firmware variability. Turning the hosted editor into a general multi-user service is **large**, chiefly because it expands GitHub credential, privacy, support, and operational responsibilities.

## What is board-specific today

The app is intentionally scoped to the Advantage360 Pro, one `Adv360-Pro-ZMK` repository, and one user. The product brief names `config/adv360.keymap`, its `adv360_left.keymap` / `adv360_right.keymap` includes, `info.json`, and two custom firmware artifacts (`firmware-clique`, `firmware-no-clique`). It explicitly restricts sign-in to `ali-aljufairi`. [Product brief](</Users/ali/github/adv360-editor/docs/PRODUCT.md>) [Roadmap](</Users/ali/github/adv360-editor/docs/ROADMAP.md>)

The existing ZMK library has a useful generic base—bindings, layers, behavior nodes, combos, CST files, and physical-key geometry—but several semantics assume this board:

- `validate()` requires **76 bindings per layer**, rejects combo positions outside `0..75`, and has a fixed ZMK behavior whitelist plus behaviors found in loaded files. [validate.ts](</Users/ali/github/adv360-editor/src/lib/zmk/validate.ts>)
- `PhysicalKey.index` is generated from array order. `loadPhysicalLayout()` accepts QMK-like `info.json` `layouts[name].layout` only; it does not parse ZMK physical-layout DTS or matrix transforms. [types.ts](</Users/ali/github/adv360-editor/src/lib/zmk/types.ts>) [layout.ts](</Users/ali/github/adv360-editor/src/lib/zmk/layout.ts>)
- `Model` holds layers, behaviors, macros, combos, and loaded files, but no selected keyboard/profile, layout identity, matrix mapping, split sides, or sensor bindings. `resolve()` walks quoted local includes and recognizes board behaviors in `boards/**/*.dtsi`; it does not resolve the full Zephyr devicetree build or external `west` modules. [types.ts](</Users/ali/github/adv360-editor/src/lib/zmk/types.ts>) [model.ts](</Users/ali/github/adv360-editor/src/lib/zmk/model.ts>)
- Current Advantage360 fixtures and the issue-research recommendations assume the 76 visible positions, Adv360’s skipped matrix locations and split halves, and combo positions that must be checked against the matrix map. A visual layout alone does not establish the ZMK key-position index. [Keymap Editor issue research](</Users/ali/github/adv360-editor/docs/research/keymap-editor-issues.md>)
- The supplied repo has one `info.json` `LAYOUT`, plus a custom board-level `adv360-layouts.dtsi` whose ordered `keys` entries and `adv360.dtsi` matrix transform define the actual key-position relationship. The current keymap has Studio combos at positions `<46 59>` and `<61>`. Its `west.yml` pins a custom ZMK fork/revision (`refil/adv360-z3.5-2`), and its custom workflow builds `adv360_left` and `adv360_right` in two jobs, with and without the Studio Clique snippet, then uploads two separately named artifacts. [Adv360 layout DTS](https://github.com/ali-aljufairi/Adv360-Pro-ZMK/blob/V3.0/config/boards/arm/adv360/adv360-layouts.dtsi) [Adv360 transform](https://github.com/ali-aljufairi/Adv360-Pro-ZMK/blob/V3.0/config/boards/arm/adv360/adv360.dtsi) [Adv360 workflow](https://github.com/ali-aljufairi/Adv360-Pro-ZMK/blob/V3.0/.github/workflows/build.yml) [Adv360 west manifest](https://github.com/ali-aljufairi/Adv360-Pro-ZMK/blob/V3.0/config/west.yml)

## Layout and hardware metadata options

| Source | What it can provide | Limits and implementation notes |
|---|---|---|
| **ZMK `zmk,physical-layout` DTS** | ZMK’s canonical physical layout associates a matrix transform and optional scan driver with an ordered list of `<&key_physical_attrs w h x y r rx ry>` geometry entries. The `keys` list is ordered like the keymap bindings and transform. | Best ZMK-native source when present. `keys` is optional for ordinary ZMK but required for ZMK Studio support. Parse the chosen layout and its order; do not assume visible geometry indices equal raw GPIO row/column matrix coordinates. [Physical layouts](https://zmk.dev/docs/hardware-integration/physical-layouts) [Layout config](https://zmk.dev/docs/config/layout) |
| **ZMK Studio metadata** | Studio uses the same compiled physical-layout keys; a Studio-capable build needs that layout metadata, and Studio build options are typically specified per build-matrix entry. | It is not an independent portable layout catalog. Firmware metadata is for Studio/runtime; for source editing, the relevant inputs remain DTS nodes and build selection. A layout node may be available without Studio, but its `keys` property is specifically required for Studio. [Studio docs](https://zmk.dev/docs/features/studio) |
| **QMK `info.json`** | Per-layout arrays describe each key’s coordinates, dimensions, label and matrix row/column; it supports multiple named layouts and aliases. | Good import/fallback, not proof of the selected ZMK transform or position order. QMK’s schema has a required `matrix` field; the app’s existing file is QMK-like but uses `row`/`col` and its custom loader ignores matrix fields. [QMK info.json reference](https://docs.qmk.fm/reference_info_json) |
| **keymap-drawer YAML** | Can encode a decoupled, manually adjustable physical layout, with layouts sourced from QMK info JSON, ZMK DTS layout, ortholinear definitions, or its own supported representations. Useful import and bootstrap reference. | It is a rendering/YAML format, not ZMK build truth. The user may need to curate it, and its geometry still needs verified position ordering. [keymap-drawer](https://github.com/caksoylar/keymap-drawer) |
| **KLE raw JSON** | Convenient visual geometry authoring/import. | Usually geometry-centric; add/verify key-position or matrix associations before using it to validate combos or edit bindings. The ZMK physical-layout guide recommends conversion paths from KLE/QMK JSON. [ZMK physical layouts](https://zmk.dev/docs/hardware-integration/physical-layouts) [QMK KLE converter instructions](https://github.com/qmk/qmk_firmware/blob/master/docs/reference_configurator_support.md) |

### Multiple layouts, splits, sensors, and hardware target selection

ZMK supports multiple physical layouts on a board, each associated with its own matrix transform and potentially scan driver. A position map can state how binding indices transfer between layouts; without one, Studio attempts matching from equal physical attributes and some keys may be unmappable. For an editor, select one concrete layout per profile/build target, and preserve the layout’s own position-map metadata if offering layout switching. [Physical layouts](https://zmk.dev/docs/hardware-integration/physical-layouts)

A ZMK matrix transform maps hardware scan row/column events into flat **key positions**, which index each layer’s binding list. Split transforms may join halves and apply row/column offsets; they can also reorder positions to match physical layout. Thus key count and geometry are separate concerns, and each layout must bind rendered keys to ordered positions. [New shield guide: matrix transform](https://zmk.dev/docs/hardware-integration/new-shield)

Splits are generally compiled as multiple build targets (often left/central and right/peripheral) that share a keymap/config; ZMK supports split boards with more than two parts. The UI should represent a shared logical keymap and the firmware outputs/parts separately, rather than treating each half as a different keyboard. [Config overview](https://zmk.dev/docs/config) [New shield guide](https://zmk.dev/docs/hardware-integration/new-shield)

Sensors are not just more keys: ZMK layers may carry `sensor-bindings` (currently encoders are the main supported sensor), while encoder push buttons may themselves be ordinary matrix positions. Add an optional sensor-binding model and separate sensor count/order from key geometry. [Keymaps and behaviors](https://zmk.dev/docs/keymaps) [Encoders](https://zmk.dev/docs/features/encoders)

A build target can be a **board** alone (on-board controller) or a **board plus shield** (common when a controller board is paired with a keyboard shield). `build.yaml` provides a build matrix: board/shield arrays for simple combinations, or explicit `include` entries for combinations and per-entry `snippet`, `cmake-args`, and `artifact-name`. `west.yml` describes ZMK and extra module repositories/revisions; a shield may live in the config repo or in a module brought in through `west.yml`. ZMK’s configuration search covers the user-config, in-tree board/shield, and module board/shield folders. [Build matrix template](https://github.com/zmkfirmware/unified-zmk-config-template/blob/main/build.yaml) [Config overview](https://zmk.dev/docs/config) [New shield guide](https://zmk.dev/docs/hardware-integration/new-shield)

**Can layout be auto-derived from fetched firmware sources? Partly, but don’t promise universal automatic discovery.** If the selected build target and module revisions are known, the app can fetch the relevant config, board/shield sources, and modules and attempt to parse an explicit `zmk,physical-layout` node. But the effective tree may combine includes, overlays, board defaults, selected shield, C preprocessor branches, and configuration choices. ZMK documents that DTS files are merged for a hardware build; deriving the final selected layout and transform robustly means reproducing those selection/preprocessing rules or obtaining generated build metadata. This app’s current parser preserves unsupported directives and intentionally does not evaluate arbitrary preprocessor code or fetch arbitrary include/module graphs. [Config overview](https://zmk.dev/docs/config) [Product/library constraints](</Users/ali/github/adv360-editor/docs/zmk-lib.md>)

Recommended approach: first support **explicit layout source and path/label selection**, parse a direct local ZMK layout node when it is self-contained, and allow QMK info.json / keymap-drawer / KLE imports as user-controlled fallbacks. Offer “verify key count/order” checks and let the user pin a layout. Add automatic source traversal only as a bounded, cacheable enhancement; do not execute repository code or silently infer a different geometry.

## Repository and build shapes

**One config repo, several keyboards:** ZMK’s normal shape supports this. `build.yaml` can include Corne left/right, a macropad, or other board/shield targets; matching `config/<shield>.keymap` or `config/<board>.keymap` files configure each, and one shared unsuffixed split keymap can apply to both sides. The user may also have multiple distinct keymap files, custom board/shield trees, and module dependencies. The profile must select the intended target and source path explicitly; never infer from “first `.keymap` found.” [ZMK user setup](https://zmk.dev/docs/user-setup) [Config overview](https://zmk.dev/docs/config)

**Several config repos:** This is still viable for the single owner. A GitHub App installation can grant access to multiple selected repositories; the GitHub App permissions are installation-level, and GitHub supports adding repositories to an installation. The current product’s one-repo installation constraint and app repo selection would need generalization, plus repository/branch/profile switching. [GitHub App installation](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party) [Changing installed repository access](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)

**Build integration is not uniform.** The upstream reusable workflow reads a `build.yaml` matrix and creates per-target artifacts, then merges them into a downloadable archive (default archive name `firmware`). The current Adv360 repo instead has a custom workflow/Makefile path with generated version metadata, explicit left/right builds, Clique and non-Clique variants, and fixed artifact names. Generic profile support therefore needs workflow identity/path and artifact mapping, not just a board name. The workflow path and exact commit should be used to correlate status/artifacts; “latest run” is ambiguous in repos with multiple workflows. [Reusable `build-user-config.yml`](https://github.com/zmkfirmware/zmk/blob/main/.github/workflows/build-user-config.yml) [Build matrix template](https://github.com/zmkfirmware/unified-zmk-config-template/blob/main/build.yaml) [Current app issue research](</Users/ali/github/adv360-editor/docs/research/keymap-editor-issues.md>)

## Effort estimates

Assumes the current parser’s lossless edit model remains, the firmware stays ZMK, and implementation includes usable UI and GitHub build flow. S = days to about 2 weeks; M = roughly 3–6 weeks; L = multiple months. These are planning estimates, not measured estimates.

### A. Ali manages several of Ali’s keyboards

| Scope | Size | Work included | Main risk |
|---|:---:|---|---|
| Several profiles in the same config repo, with explicit board/shield, file, layout, and build target | **M** | Remove fixed 76/key-position bounds; generalize layer and layout models; add profile/keyboard chooser; select the correct keymap and geometry; model splits and optional sensors; read build matrix; resolve exact workflow/run/artifacts. | Layout order/transform mismatch or custom firmware workflow behavior produces misleading editing or artifact links. |
| Same plus a few additional private/public repos owned by Ali | **M** (upper end) | Above plus repo list/selection and branch selection; expand the installed GitHub App’s selected-repo access; persist independent profile settings per repo. | Extra permissions/install setup; repo-specific module/layout/build conventions. |
| Hands-off discovery of arbitrary ZMK keyboards and layouts | **L** | Bounded `west.yml`/module fetching; resolve target-specific DTS/overlays/conditionals; broad layout importers; robust fallbacks and diagnostics. | Devicetree build semantics, custom forks, version drift, incomplete metadata. Avoid making this a prerequisite for A. |

### B. The app serves other people (multi-user)

| Scope | Size | Work included | Main risk |
|---|:---:|---|---|
| Convert the current single-user hosted app into a multi-user service | **L** (roughly 2–4+ engineer-months before broad-board polish) | Multi-user GitHub login and account linking; user/installation/repo authorization; installation and permissions onboarding; tenant isolation for profiles, branches, diffs, and build runs; secure token lifecycle and revocation; abuse/rate limits, audit logs, operational monitoring, support and incident process; privacy/security review. | Credential exposure or cross-user repository data leaks; app installation friction; hosting, GitHub API, and build-run reliability at public scale. |
| Make it broadly useful to other ZMK users | **L+** | Add A’s generic model/layout/build work, documentation and onboarding, custom behavior/raw support, compatibility strategy, and ongoing board/version maintenance. | Long tail of custom modules/forks and inconsistent source metadata. |

A and B are separate axes: multi-profile support does not require multi-user auth. B inherits the layout/build scope needed by its intended audience and also recreates the hosted GitHub integration burden. The upstream Keymap Editor maintainer specifically cites the security of managing GitHub integration and the overhead of hosting its API server as the main reasons for winding integration down, while retaining static/clipboard editing. This is a useful operational warning, not proof that a smaller single-owner service has the same cost. [Maintainer’s notice](https://github.com/nickcoutsos/keymap-editor/wiki/Discontinuing-GitHub-Integration)

## Suggested `KeyboardProfile` shape

Keep profile selection and GitHub/build routing outside the pure ZMK parser model. Store it per keyboard/profile and keep target-specific settings explicit:

```ts
interface KeyboardProfile {
  id: string
  name: string
  repo: { owner: string; name: string; installationId?: number }
  branch: string
  configRoot: string                 // usually "config"
  keymap: {
    path: string                     // exact .keymap file for this target
    entryNode?: string               // if different keymap roots later matter
    sharedAcrossParts?: boolean
  }
  target: {
    board: string
    shield?: string                  // target may be board-only
    parts?: Array<{ id: string; board?: string; shield?: string; role?: string }>
    buildMatrixEntry?: string        // stable identity or serialized target selector
  }
  layout: {
    source: 'zmk-dts' | 'qmk-info-json' | 'keymap-drawer' | 'kle' | 'manual'
    path?: string
    layoutName?: string
    nodeLabel?: string
    keyCount: number                 // derived when trusted; otherwise explicit/pinned
    positionMapPath?: string
    verified: boolean
  }
  build: {
    workflowPath: string
    kind: 'zmk-reusable' | 'custom'
    matrixPath?: string              // e.g. build.yaml
    artifactMap: Record<string, string[]> // logical output/part -> exact artifact names
  }
  sensors?: { count: number; labels?: string[] }
}
```

Do not bake `keyCount` into a board-global constant: validate a layer against the selected profile/layout and report when key count/order is unverified. Keep combo positions as ZMK key-position indices and check them against the selected binding array, not rendered key coordinates.

## Design now; defer the rest

**Design now**

1. Remove the fixed `76` assumptions from validation and model APIs; pass a selected layout/profile’s expected positions into validation. Keep separate representations for geometry, logical key positions, and matrix row/column mapping.
2. Add a layout-source interface so QMK-like JSON remains supported while ZMK DTS and manual/imported layout sources can be added without changing keymap parsing. Store layout identity and an explicit verification state.
3. Add ZMK `sensor-bindings` as a separate optional model field; keep split build parts separate from logical keymap layers.
4. Make GitHub build dispatch/status/artifact lookup accept workflow path, target identity, commit SHA, and artifact mapping. Preserve today’s Adv360 custom flow as one adapter/profile.
5. Keep the profile boundary separate from `Model` and UI state; thread an explicit profile id through loads, edits, commits, and build runs. Keep behavior metadata versioned/configurable, retaining the raw/unknown fallback.
6. Keep repository selection and auth authorization checks in the server-side `GitHubGateway`, so the future repository/profile model does not need client-side credentials.

**Postpone**

- Multi-user accounts, public GitHub App installation/onboarding, tenant data storage, and service operations (B).
- General firmware support beyond ZMK, automatic execution or full evaluation of arbitrary DTS/C preprocessor code, and unrestricted recursive module discovery.
- Heuristic board discovery when profile selection can be explicit; automatic layout generation from every source format; all layouts/variants for every keyboard. Start with the target and layout the user selects.

## Sources consulted

- Local product and implementation: `docs/PRODUCT.md`, `docs/ROADMAP.md`, `docs/zmk-lib.md`, `docs/research/keymap-editor-issues.md`; `src/lib/zmk/{types,model,validate,layout}.ts`; current Adv360 `config/boards/arm/adv360/{adv360-layouts.dtsi,adv360.dtsi}`, `config/info.json`, `config/west.yml`, and `.github/workflows/build.yml`.
- Current upstream ZMK documentation: [user setup](https://zmk.dev/docs/user-setup), [config](https://zmk.dev/docs/config), [layout configuration](https://zmk.dev/docs/config/layout), [physical layouts](https://zmk.dev/docs/hardware-integration/physical-layouts), [new shield guide](https://zmk.dev/docs/hardware-integration/new-shield), [keymaps](https://zmk.dev/docs/keymaps), [encoders](https://zmk.dev/docs/features/encoders), [Studio](https://zmk.dev/docs/features/studio).
- Current upstream build/config references: [`build-user-config.yml`](https://github.com/zmkfirmware/zmk/blob/main/.github/workflows/build-user-config.yml), [`unified-zmk-config-template/build.yaml`](https://github.com/zmkfirmware/unified-zmk-config-template/blob/main/build.yaml).
- Layout formats and integration: [QMK `info.json`](https://docs.qmk.fm/reference_info_json), [QMK KLE-to-JSON guidance](https://github.com/qmk/qmk_firmware/blob/master/docs/reference_configurator_support.md), [keymap-drawer](https://github.com/caksoylar/keymap-drawer).
- GitHub App access: [installing a GitHub App](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party), [reviewing/changing repository access](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps), [permissions guidance](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).
- Hosting/maintenance signal: [Keymap Editor maintainer notice](https://github.com/nickcoutsos/keymap-editor/wiki/Discontinuing-GitHub-Integration).
