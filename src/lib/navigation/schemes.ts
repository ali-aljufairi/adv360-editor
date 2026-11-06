import { ACTIONS, type Action } from './actions'

/** Built-in and user-defined navigation schemes. */
export const SCHEME_NAMES = ['arrows', 'vim', 'emacs', 'custom'] as const

/** A navigation scheme name. */
export type SchemeName = (typeof SCHEME_NAMES)[number]

/** Human-readable scheme labels for the settings panel. */
export const SCHEME_LABELS: Record<SchemeName, string> = {
  arrows: 'Arrows',
  vim: 'Vim',
  emacs: 'Emacs',
  custom: 'Custom',
}

/** A complete binding table: every action maps to zero or more key sequences. */
export type SchemeBindings = Record<Action, string[]>

/** Per-action overrides, used only by the `custom` scheme. */
export type CustomBindings = Partial<Record<Action, string[]>>

/** Arrow keys that move the selection, used by `arrowsAlwaysOn`. */
export const ARROW_MOVES: readonly { action: Action; key: string }[] = [
  { action: 'left', key: 'ArrowLeft' },
  { action: 'right', key: 'ArrowRight' },
  { action: 'up', key: 'ArrowUp' },
  { action: 'down', key: 'ArrowDown' },
]

/** A full table with every action unbound, overlaid with `partial`. Arrays are never shared. */
function preset(partial: Partial<SchemeBindings>): SchemeBindings {
  const table = {} as SchemeBindings
  for (const action of ACTIONS) table[action] = [...(partial[action] ?? [])]
  return table
}

/**
 * Preset tables. Browser-reserved combinations are avoided where a better option exists.
 * Emacs `C-n`, `C-p`, `C-f`, `C-b`, `C-a`, `C-e` are kept because they are the scheme's
 * motions; see docs/navigation.md for where the browser can take them first.
 */
export const PRESETS: Record<Exclude<SchemeName, 'custom'>, SchemeBindings> = {
  arrows: preset({
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    next: ['Tab'],
    prev: ['S-Tab'],
    rowStart: ['Home'],
    rowEnd: ['End'],
    first: ['Meta-ArrowUp', 'C-Home'],
    last: ['Meta-ArrowDown', 'C-End'],
    edit: ['Enter'],
    cancel: ['Escape'],
    nextLayer: [']'],
    prevLayer: ['['],
    undo: ['Meta-z', 'C-z'],
    redo: ['Meta-S-z', 'C-S-z'],
    help: ['?'],
  }),
  vim: preset({
    left: ['h'],
    right: ['l'],
    up: ['k'],
    down: ['j'],
    next: ['w'],
    prev: ['b'],
    rowStart: ['0', '^'],
    rowEnd: ['$'],
    first: ['gg'],
    last: ['G'],
    edit: ['Enter', 'i'],
    cancel: ['Escape'],
    nextLayer: ['gt'],
    prevLayer: ['gT'],
    undo: ['u'],
    redo: ['C-r'],
    help: ['?'],
  }),
  emacs: preset({
    left: ['C-b'],
    right: ['C-f'],
    up: ['C-p'],
    down: ['C-n'],
    next: ['M-f'],
    prev: ['M-b'],
    rowStart: ['C-a'],
    rowEnd: ['C-e'],
    // `M-S-,` and `M-S-.` are what Option+Shift reports on macOS, where the glyph is not ASCII.
    first: ['M-<', 'M-S-,'],
    last: ['M->', 'M-S-.'],
    edit: ['Enter'],
    cancel: ['C-g'],
    undo: ['C-/', 'C-_'],
    redo: ['C-?'],
    help: ['F1'],
  }),
}

/** Whether a scheme's preset uses vim-style numeric counts. */
export function usesCounts(scheme: SchemeName): boolean {
  return scheme === 'vim'
}

/** Undo/redo shortcuts that stay active whatever navigation scheme is selected. */
const UNIVERSAL_KEYS: { action: Action; key: string }[] = [
  { action: 'undo', key: 'Meta-z' },
  { action: 'undo', key: 'C-z' },
  { action: 'redo', key: 'Meta-S-z' },
  { action: 'redo', key: 'C-S-z' },
  { action: 'redo', key: 'C-y' },
]

/**
 * The effective table for a scheme. `custom` applies its overrides on top of the arrows preset;
 * other schemes ignore `custom`, so switching presets never discards a user's overrides.
 * With `arrowsAlwaysOn`, the four arrow keys are added to the movement actions too.
 */
export function resolveBindings(
  scheme: SchemeName,
  custom: CustomBindings,
  opts: { arrowsAlwaysOn: boolean },
): SchemeBindings {
  const base = scheme === 'custom' ? PRESETS.arrows : PRESETS[scheme]
  const table = Object.fromEntries(
    ACTIONS.map((action) => {
      const override = scheme === 'custom' ? custom[action] : undefined
      return [action, [...(override ?? base[action])]]
    }),
  ) as SchemeBindings
  if (opts.arrowsAlwaysOn && scheme !== 'arrows') {
    for (const { action, key } of ARROW_MOVES) {
      if (!table[action].includes(key)) table[action].push(key)
    }
  }
  // Undo and redo with the platform shortcuts work in every scheme; people expect them.
  for (const { action, key } of UNIVERSAL_KEYS) {
    if (!table[action].includes(key)) table[action].push(key)
  }
  return table
}
