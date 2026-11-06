/** Every command the board understands. Movement actions are handled by the board hook. */
export const ACTIONS = [
  'left',
  'right',
  'up',
  'down',
  'next',
  'prev',
  'rowStart',
  'rowEnd',
  'first',
  'last',
  'edit',
  'cancel',
  'nextLayer',
  'prevLayer',
  'undo',
  'redo',
  'help',
] as const

/** A board command that a key sequence can trigger. */
export type Action = (typeof ACTIONS)[number]

/** Actions that move the selection across the board. */
export const MOVE_ACTIONS: readonly Action[] = [
  'left',
  'right',
  'up',
  'down',
  'next',
  'prev',
  'rowStart',
  'rowEnd',
  'first',
  'last',
]

/** Human-readable label for each action, used in the settings cheat sheet. */
export const ACTION_LABELS: Record<Action, string> = {
  left: 'Move left',
  right: 'Move right',
  up: 'Move up',
  down: 'Move down',
  next: 'Next key',
  prev: 'Previous key',
  rowStart: 'Start of row',
  rowEnd: 'End of row',
  first: 'First key',
  last: 'Last key',
  edit: 'Edit key',
  cancel: 'Cancel',
  nextLayer: 'Next layer',
  prevLayer: 'Previous layer',
  undo: 'Undo',
  redo: 'Redo',
  help: 'Show help',
}

/** Type guard for values read from storage or user input. */
export function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value)
}
