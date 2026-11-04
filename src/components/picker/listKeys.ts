import type { SchemeName } from '../../lib/navigation/schemes'

/** What a navigation key does in the results list. */
export type ListAction = 'up' | 'down' | 'close'

/** Arrow keys move the list in every scheme. */
const ARROW_KEYS: ReadonlyMap<string, ListAction> = new Map<string, ListAction>([
  ['ArrowDown', 'down'],
  ['ArrowUp', 'up'],
])

/**
 * Extra list keys per scheme, on top of the arrows. Plain letters are never listed here: they
 * type into the search field. `custom` falls back to the arrows.
 */
const SCHEME_KEYS: Record<SchemeName, ReadonlyMap<string, ListAction>> = {
  arrows: new Map<string, ListAction>(),
  custom: new Map<string, ListAction>(),
  vim: new Map<string, ListAction>([
    ['C-j', 'down'],
    ['C-k', 'up'],
    ['C-n', 'down'],
    ['C-p', 'up'],
  ]),
  emacs: new Map<string, ListAction>([
    ['C-n', 'down'],
    ['C-p', 'up'],
    ['C-g', 'close'],
  ]),
}

/**
 * Maps a key token (from `eventToToken`) to a list action for the active navigation scheme.
 * @param token - The key as a navigation token, e.g. `C-j`, or null for modifier-only presses.
 * @param scheme - The active navigation scheme.
 * @returns The list action, or null when the key should type into the search field instead.
 */
export function pickerKeyAction(token: string | null, scheme: SchemeName): ListAction | null {
  if (token === null) return null
  return ARROW_KEYS.get(token) ?? SCHEME_KEYS[scheme].get(token) ?? null
}

/** A run of label text, flagged when the query matches it. */
export interface TextSpan {
  text: string
  hit: boolean
}

/**
 * Finds the characters of `label` that `query` matches. Each query word is matched as a
 * substring when it appears, otherwise as a subsequence; a word that matches neither marks
 * nothing.
 * @param label - The row label.
 * @param query - The search text.
 * @returns Adjacent spans covering the whole label, with matched runs flagged.
 */
export function matchSpans(label: string, query: string): TextSpan[] {
  const lower = label.toLowerCase()
  const hits = new Array<boolean>(label.length).fill(false)
  for (const word of query.toLowerCase().split(/\s+/)) {
    if (word.length === 0) continue
    const at = lower.indexOf(word)
    if (at >= 0) {
      for (let index = at; index < at + word.length; index += 1) hits[index] = true
      continue
    }
    const found: number[] = []
    let from = 0
    for (const char of word) {
      const position = lower.indexOf(char, from)
      if (position < 0) {
        found.length = 0
        break
      }
      found.push(position)
      from = position + 1
    }
    for (const position of found) hits[position] = true
  }
  const spans: TextSpan[] = []
  for (let index = 0; index < label.length; index += 1) {
    const hit = hits[index]
    const last = spans.at(-1)
    if (last && last.hit === hit) last.text += label.charAt(index)
    else spans.push({ text: label.charAt(index), hit })
  }
  return spans
}
