/** The searchable text of one picker entry. */
export interface SearchFields {
  /** Human label, e.g. "Left shift". Weighted fully. */
  label: string
  /** ZMK code as written in the keymap. Weighted fully. */
  code?: string
  /** Accepted ZMK aliases. Weighted slightly below the code. */
  aliases?: readonly string[]
  /** Free-form keywords such as "copy". Weighted lowest so they never outrank names. */
  keywords?: readonly string[]
}

const WEIGHT_PRIMARY = 1
const WEIGHT_ALIAS = 0.95
const WEIGHT_KEYWORD = 0.6

/**
 * Splits text into lowercase alphanumeric words. Punctuation and underscores separate words,
 * so `KP_N1` becomes `kp`, `n1` and `LC(A)` becomes `lc`, `a`.
 * @param text - Any label, code or keyword.
 * @returns The words and their concatenation.
 */
function normalize(text: string): { words: string[]; flat: string } {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
  return { words, flat: words.join('') }
}

/**
 * Scores a query token that must appear, in order, as a subsequence of the text.
 * Returns 0 when the token cannot be found.
 * @param token - Lowercase alphanumeric query token.
 * @param flat - Lowercase text with separators removed.
 * @returns A score between 1 and 300.
 */
function subsequenceScore(token: string, flat: string): number {
  let position = 0
  let gaps = 0
  let first = -1
  for (const char of token) {
    const found = flat.indexOf(char, position)
    if (found < 0) return 0
    if (first < 0) first = found
    else gaps += found - position
    position = found + 1
  }
  return Math.max(1, 300 - Math.min(gaps * 4, 120) - Math.min(first, 40))
}

/**
 * Scores one token against one piece of text, using the strongest rule that matches:
 * exact > prefix > word-start prefix > word initials > subsequence.
 * @param token - Lowercase alphanumeric query token.
 * @param text - Candidate text.
 * @returns A score from 0 (no match) to 1000 (exact).
 */
function scoreToken(token: string, text: string): number {
  const { words, flat } = normalize(text)
  if (words.length === 0) return 0
  if (flat === token) return 1000
  if (flat.startsWith(token)) return 900 - Math.min(flat.length - token.length, 99)
  let best = 0
  words.forEach((word, index) => {
    if (word.startsWith(token)) best = Math.max(best, 700 - Math.min(index, 10) * 10)
  })
  const initials = words.map((word) => word.charAt(0)).join('')
  if (token.length > 1 && initials.startsWith(token)) best = Math.max(best, 500)
  if (best > 0) return best
  return subsequenceScore(token, flat)
}

/**
 * Scores a query against one entry. Every query word must match at least one field;
 * the entry score is the mean of the per-word scores, so multi-word queries rank tighter matches
 * higher.
 * @param query - What the user typed.
 * @param fields - The entry's searchable text.
 * @returns A score above 0 when the entry matches, or 0 when it does not.
 */
export function scoreEntry(query: string, fields: SearchFields): number {
  const tokens = normalize(query).words
  if (tokens.length === 0) return 0
  const weighted: [string, number][] = [[fields.label, WEIGHT_PRIMARY]]
  if (fields.code) weighted.push([fields.code, WEIGHT_PRIMARY])
  for (const alias of fields.aliases ?? []) weighted.push([alias, WEIGHT_ALIAS])
  for (const keyword of fields.keywords ?? []) weighted.push([keyword, WEIGHT_KEYWORD])
  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const [text, weight] of weighted) {
      best = Math.max(best, scoreToken(token, text) * weight)
    }
    if (best === 0) return 0
    total += best
  }
  return total / tokens.length
}

/**
 * Filters and ranks items by fuzzy match. An empty query keeps the original order.
 * Ties keep the original order, so the catalog's own ordering is the tiebreaker.
 * @param query - What the user typed.
 * @param items - Entries to rank.
 * @param toFields - Extracts the searchable text from an entry.
 * @returns Matching entries, best first.
 */
export function rankEntries<T>(
  query: string,
  items: readonly T[],
  toFields: (item: T) => SearchFields,
): T[] {
  if (normalize(query).words.length === 0) return [...items]
  const scored: { item: T; score: number; index: number }[] = []
  items.forEach((item, index) => {
    const score = scoreEntry(query, toFields(item))
    if (score > 0) scored.push({ item, score, index })
  })
  scored.sort((left, right) => right.score - left.score || left.index - right.index)
  return scored.map((entry) => entry.item)
}
