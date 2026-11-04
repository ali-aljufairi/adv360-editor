import { ACTIONS, type Action } from './actions'
import { parseSequence } from './keys'

/** Bindings as user-facing sequence strings, keyed by action. */
export type BindingMap = Partial<Record<Action, readonly string[]>>

/** Options for {@link createSequenceMatcher}. */
export interface MatcherOptions {
  /** Pause after which a half-typed sequence is abandoned. Defaults to 800 ms. */
  timeoutMs?: number
  /** Accept vim-style numeric counts (`3l`). Defaults to false. */
  counts?: boolean
}

/** Result of feeding one token to a matcher. */
export type MatchResult =
  | { kind: 'pending' }
  | { kind: 'none' }
  | { kind: 'match'; action: Action; count: number; tokens: string[] }

/** A stateful matcher for single keys and multi-key sequences. */
export interface SequenceMatcher {
  /** Feeds one canonical token; `now` is a timestamp in ms (defaults to `Date.now()`). */
  feed(token: string, now?: number): MatchResult
  /** Resolves a pending sequence that is already a complete binding, if one is waiting. */
  flush(): MatchResult
  /** Text typed so far (count and partial sequence), for display. */
  pending(): string
  /** Drops any partial sequence or count. */
  reset(): void
  /** Milliseconds a partial sequence waits before it is abandoned. */
  readonly timeoutMs: number
}

const DEFAULT_TIMEOUT_MS = 800

/**
 * Builds a matcher for the given bindings. Sequences are parsed with {@link parseSequence}, so
 * `gg` is two tokens and `C-x C-s` is two. When two actions share a sequence the earlier action
 * in {@link ACTIONS} order wins. With `counts`, digits before a binding multiply it (`3j`),
 * and `0` only counts once a non-zero digit has been typed.
 */
export function createSequenceMatcher(
  bindings: BindingMap,
  opts: MatcherOptions = {},
): SequenceMatcher {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const counts = opts.counts ?? false
  const table = buildTable(bindings)
  let buffer: string[] = []
  let count = 0
  let lastAt = Number.NEGATIVE_INFINITY

  function reset(): void {
    buffer = []
    count = 0
  }

  function exactMatch(tokens: string[]): { action: Action; tokens: string[] } | undefined {
    return table.find((entry) => sameTokens(entry.tokens, tokens))
  }

  function hasLongerBinding(tokens: string[]): boolean {
    return table.some(
      (entry) =>
        entry.tokens.length > tokens.length && startsWith(entry.tokens, tokens),
    )
  }

  function matched(entry: { action: Action; tokens: string[] }): MatchResult {
    const result: MatchResult = {
      kind: 'match',
      action: entry.action,
      count: Math.max(1, count),
      tokens: entry.tokens,
    }
    reset()
    return result
  }

  return {
    timeoutMs,
    feed(token: string, now: number = Date.now()): MatchResult {
      if ((buffer.length > 0 || count > 0) && now - lastAt > timeoutMs) reset()
      lastAt = now

      if (counts && buffer.length === 0 && /^[0-9]$/.test(token)) {
        if (token !== '0' || count > 0) {
          count = count * 10 + Number(token)
          return { kind: 'pending' }
        }
      }

      buffer.push(token)
      const exact = exactMatch(buffer)
      if (hasLongerBinding(buffer)) return { kind: 'pending' }
      if (exact) return matched(exact)
      reset()
      return { kind: 'none' }
    },
    flush(): MatchResult {
      const exact = exactMatch(buffer)
      if (!exact) return { kind: 'none' }
      return matched(exact)
    },
    pending(): string {
      const countText = count > 0 ? String(count) : ''
      return countText + buffer.join('')
    },
    reset,
  }
}

/** Flattens bindings into a list of parsed sequences, earliest action first. */
function buildTable(bindings: BindingMap): { action: Action; tokens: string[] }[] {
  const table: { action: Action; tokens: string[] }[] = []
  for (const action of ACTIONS) {
    for (const sequence of bindings[action] ?? []) {
      const tokens = parseSequence(sequence)
      if (tokens.length === 0) continue
      if (table.some((entry) => sameTokens(entry.tokens, tokens))) continue
      table.push({ action, tokens })
    }
  }
  return table
}

function sameTokens(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && startsWith(left, right)
}

function startsWith(list: readonly string[], prefix: readonly string[]): boolean {
  if (prefix.length > list.length) return false
  return prefix.every((token, index) => list[index] === token)
}
