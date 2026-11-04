# M2 contracts — the editor page

The editor page (`/`) is assembled from three parallel pieces. Each piece codes against these
interfaces only; the product owner wires them together in `src/routes/index.tsx`.

## Piece A — editor state (`src/lib/editor-state/`, Terra)

```ts
interface EditorState {
  profile: KeyboardProfile          // src/lib/profile
  files: FileMap                    // current text of every config file
  model: Model                      // src/lib/zmk resolve() of `files`
  layout: PhysicalLayout            // src/lib/layout
  issues: Issue[]                   // validate(model, { layout })
  activeLayer: number
  selectedKey: number | null
  dirty: boolean                    // files differ from the loaded baseline
  canUndo: boolean
  canRedo: boolean
}

interface EditorActions {
  selectKey(index: number | null): void
  setActiveLayer(index: number): void
  setBinding(layer: number, key: number, binding: string | BindingInput): void
  updateMacro / updateHoldTap / addCombo / updateCombo / removeCombo   // thin wrappers
  undo(): void
  redo(): void
  diff(): Record<string, string>    // unified diff per changed file vs baseline
  reset(): void                     // discard all changes
  load(files: FileMap, profile: KeyboardProfile): void
}

function EditorProvider(props: { initialFiles: FileMap; profile: KeyboardProfile; children })
function useEditor(): EditorState & EditorActions
```

- History: every edit pushes a snapshot of `files` (cap 200); coalesce repeated edits of the same
  key within 1 s.
- Drafts survive reloads: persist `files` + baseline hash to localStorage (try/catch), restore on
  load if the baseline matches, otherwise warn.
- `beforeunload` warning when `dirty`.
- Initial data for now: the fixture files in `fixtures/adv360/` (GitHub loading is M4).

## Piece B — board (`src/components/board/`, Haiku)

```ts
interface BoardProps {
  layout: PhysicalLayout
  bindings: Binding[] // bindings of the active layer
  legendContext: DescribeContext // layer names + macro labels for describeBinding
  selectedKey: number | null
  changedKeys: Set<number> // keys differing from baseline on this layer
  combos: Combo[] // drawn as arcs; dim ones not active on this layer
  layerAccent: 1 | 2 | 3 | 4 // var(--accent-layer-N)
  onSelectKey(index: number): void
  onActivateKey(index: number): void // double-click / Enter → open picker
}
interface LayerTabsProps {
  layers: { index: number; name: string; unreachable: boolean }[]
  active: number
  onChange(index: number): void
}
```

- Uses `Keycap` (src/components/keycap) and the layout geometry (rotation around rx/ry).
- Scales to the container width (ResizeObserver); no horizontal scroll down to 390px (board may
  scale small; keycaps stay legible via fitLegend).

## Piece C — panels (`src/components/panels/`, `src/components/theme-picker/`, Haiku)

```ts
interface ProblemsPanelProps {
  issues: Issue[]
  onJump(issue: Issue): void
}
interface ChangesPillProps {
  count: number
  onOpen(): void
}
interface ChangesSheetProps {
  diff: Record<string, string>
  summary: string[] // human-readable lines, e.g. "Base · key 12: Caps → Esc"
  onClose(): void
  onDiscard(): void
}
interface ThemePickerProps {
  open: boolean
  onClose(): void
} // uses useTheme()
```

- Theme picker ports the approved design in `design/approved/board-first-themes.html`
  (search, live preview while arrowing, favourites, light/dark/system, import Ghostty/OpenCode).
- Commit/Build buttons appear in the sheet but are disabled with "Coming in M4".
