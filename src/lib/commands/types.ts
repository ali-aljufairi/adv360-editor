import type { SchemeName } from '../navigation/schemes'
import type { PlatformSetting } from '../keycodes/platform'

/** Section a command is listed under in the ⌘K palette, in display order. */
export const COMMAND_GROUPS = [
  'Layers',
  'Edit',
  'View',
  'Behaviors',
  'Settings',
  'Theme',
  'Help',
] as const
/** A palette section name. */
export type CommandGroup = (typeof COMMAND_GROUPS)[number]

/** One entry in the ⌘K command palette. */
export interface Command {
  /** Stable id, e.g. `layer.add`, `layer.go.3`, `settings.scheme.vim`, `theme.mode.dark`. */
  id: string
  /** What the palette shows, e.g. "Add layer…", "Go to Keypad", "Navigation: Vim". */
  title: string
  group: CommandGroup
  /** Extra words that should match in search (e.g. "new", "create" for Add layer). */
  keywords?: string[]
  /** Shortcut to display, already formatted for the platform (e.g. "⌘Z", "Ctrl+Z", "3"). */
  shortcut?: string
  /** Shown but not runnable (e.g. Undo with nothing to undo). */
  disabled?: boolean
  /** For option-style commands: true when this option is the current value. */
  checked?: boolean
  run(): void
}

/** Everything buildCommands needs; the editor page supplies it. */
export interface CommandContext {
  layers: { index: number; name: string }[]
  activeLayer: number
  setActiveLayer(index: number): void
  /** Open the add-layer dialog. */
  addLayer(): void
  renameLayer(index: number): void
  moveLayer(index: number, to: number): void
  /** Open the delete confirmation for a layer. */
  deleteLayer(index: number): void

  /** Batch command integration; dialog-backed operations may be supplied by the UI. */
  batch?: {
    selectedCount: number
    canPaste: boolean
    copy(): void
    paste(): void
    cut(): void
    clear(): void
    swap(): void
    swapAcrossLayers(): void
    assign(): void
    copyLayer(): void
  }

  canUndo: boolean
  canRedo: boolean
  undo(): void
  redo(): void
  dirty: boolean
  /** Open the review-changes sheet. */
  reviewChanges(): void
  /** Discard every unsaved change (the palette confirms first). */
  discardChanges(): void

  combosShown: boolean
  toggleCombos(): void
  openBehaviors(): void
  /** Open the full theme picker (live preview, import). */
  openThemePicker(): void
  themeMode: 'system' | 'light' | 'dark'
  setThemeMode(mode: 'system' | 'light' | 'dark'): void
  openSettings(): void
  openHelp(): void

  scheme: SchemeName
  setScheme(scheme: SchemeName): void
  arrowsAlwaysOn: boolean
  setArrowsAlwaysOn(on: boolean): void
  wrap: boolean
  setWrap(on: boolean): void
  platform: PlatformSetting
  setPlatform(platform: PlatformSetting): void
  /** Platform used to format shortcuts. */
  displayPlatform: 'mac' | 'windows' | 'linux'
}
