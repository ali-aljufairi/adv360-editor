/**
 * Keycap legend fitting.
 *
 * Width model (approximate, deterministic, safe for SSR — no DOM measurement):
 * - All widths are in em of the `lg` legend font. A keycap of `w` units offers
 *   `w * UNIT_EM` em of space; `PAD_EM` is reserved for horizontal padding.
 * - The keycap font is sized as `unit / UNIT_EM` (see Keycap.tsx), so one em of
 *   the `lg` font is exactly 1/UNIT_EM of a keycap unit and the model is exact
 *   with respect to the CSS.
 * - Each character has an approximate advance width in em (see `charWidthEm`).
 *   Deliberately a little generous, so real glyph widths stay inside the budget.
 * - A smaller size scales the whole line by `LEGEND_SCALE[size]`.
 */

/** Font size steps for legends, largest first. */
export type LegendSize = 'lg' | 'md' | 'sm' | 'xs'

/** Result of fitting a legend onto a keycap. `text` may contain `\n` when `lines` is 2. */
export interface FittedLegend {
  /** Text to render; a `\n` separates the two lines when `lines` is 2. */
  text: string
  /** Font size step to render at. */
  size: LegendSize
  /** Number of rendered lines. */
  lines: 1 | 2
}

/** Font size multiplier for each step, relative to the `lg` font. */
export const LEGEND_SCALE: Record<LegendSize, number> = { lg: 1, md: 0.8, sm: 0.65, xs: 0.5 }

/** Font size steps in the order they are tried. */
export const SIZE_ORDER: LegendSize[] = ['lg', 'md', 'sm', 'xs']

/** Em of `lg` legend font that fit across one keycap unit. */
export const UNIT_EM = 4

/** Em of `lg` font reserved for horizontal padding across the whole keycap. */
export const PAD_EM = 1

/** Word-level abbreviations applied when a legend does not fit at full length. */
export const ABBREVIATIONS: Record<string, string> = {
  Keypad: 'Kpd',
  Space: 'Spc',
  Backspace: 'Bksp',
  Delete: 'Del',
  Escape: 'Esc',
  Enter: 'Ent',
  Control: 'Ctrl',
  Option: 'Opt',
  Bluetooth: 'BT',
  Screensaver: 'Scrn',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Insert: 'Ins',
  CapsLock: 'Caps',
  NumLock: 'NumLk',
  PrintScreen: 'PrtSc',
  ScrollLock: 'ScrLk',
  Previous: 'Prev',
  Volume: 'Vol',
  Clear: 'Clr',
}

const NARROW = new Set(['i', 'l', 'j', 'I', 'f', 't', 'r', '.', ',', ';', ':', '!', '|', "'", '`'])
const WIDE = new Set(['m', 'w', 'M', 'W', '@', '%'])

/**
 * Approximate advance width of one character, in em of the legend font.
 * Narrow punctuation and spaces are small, capitals and wide letters are larger,
 * and anything outside basic Latin (modifier glyphs, arrows) is treated as wide.
 */
export function charWidthEm(ch: string): number {
  if (ch === ' ') return 0.3
  if (NARROW.has(ch)) return 0.3
  if (WIDE.has(ch)) return 0.85
  if (/[A-Z]/.test(ch)) return 0.66
  if (/[0-9]/.test(ch)) return 0.56
  if (ch.charCodeAt(0) < 0x2000) return 0.56
  return 0.9
}

/** Width of a single line in `lg` em (before the size scale is applied). */
export function measureEm(line: string): number {
  let total = 0
  for (const ch of line) total += charWidthEm(ch)
  return total
}

/** Usable width of a keycap of `widthUnits`, in `lg` em. */
export function capacityEm(widthUnits: number): number {
  return Math.max(0, widthUnits * UNIT_EM - PAD_EM)
}

/** Whether `line` fits on one row of a keycap of `widthUnits` at `size`. */
export function lineFits(line: string, size: LegendSize, widthUnits: number): boolean {
  return measureEm(line) * LEGEND_SCALE[size] <= capacityEm(widthUnits)
}

/** Applies the abbreviation table to whole words. Unknown words are left alone. */
export function abbreviate(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) =>
    Object.hasOwn(ABBREVIATIONS, word) ? (ABBREVIATIONS[word] ?? word) : word,
  )
}

/** Characters after which a line may break (kept at the end of the first line). */
const BREAK_AFTER = new Set(['/', '+', '-', '_', '·', '.'])

/**
 * Natural break positions. Each is a split index: the first line is `text[0, index)`.
 * Separators stay on the first line so no character is ever lost.
 */
function naturalBreaks(text: string): number[] {
  const breaks: number[] = []
  for (let index = 1; index < text.length; index += 1) {
    const prev = text[index - 1] ?? ''
    const here = text[index] ?? ''
    if (prev === ' ' || BREAK_AFTER.has(prev)) breaks.push(index)
    else if (/[a-z]/.test(prev) && /[A-Z]/.test(here)) breaks.push(index)
  }
  return breaks
}

/** Splits `text` into two lines at a break that fits both lines; picks the most balanced. */
function splitTwo(
  text: string,
  size: LegendSize,
  widthUnits: number,
  breaks: number[],
): string | null {
  let best: { lines: [string, string]; worst: number } | null = null
  for (const index of breaks) {
    const first = text.slice(0, index)
    const second = text.slice(index)
    if (!second || !first) continue
    if (!lineFits(first, size, widthUnits) || !lineFits(second, size, widthUnits)) continue
    const worst = Math.max(measureEm(first), measureEm(second))
    if (!best || worst < best.worst) best = { lines: [first, second], worst }
  }
  return best ? `${best.lines[0]}\n${best.lines[1]}` : null
}

/** Last resort: keep the longest prefix that fits with a visible ellipsis. */
function ellipsize(text: string, widthUnits: number): string {
  for (let end = text.length - 1; end > 0; end -= 1) {
    const candidate = `${text.slice(0, end)}…`
    if (lineFits(candidate, 'xs', widthUnits)) return candidate
  }
  return '…'
}

/**
 * Fits a legend onto a keycap of `widthUnits` keycap units.
 *
 * Order: full text at `lg` → abbreviated text stepping down through the sizes →
 * two lines (natural breaks first, then any character) stepping down the sizes →
 * as a last resort, an ellipsized abbreviation. Characters are never dropped
 * silently; the ellipsis is the only visible truncation.
 *
 * @param text Legend text to fit.
 * @param widthUnits Keycap width in units (1, 1.25, 1.5, 2, ...).
 * @returns Text, font size step and line count. Every line satisfies `lineFits`.
 */
export function fitLegend(text: string, widthUnits: number): FittedLegend {
  if (lineFits(text, 'lg', widthUnits)) return { text, size: 'lg', lines: 1 }

  const short = abbreviate(text)
  for (const size of SIZE_ORDER) {
    if (lineFits(short, size, widthUnits)) return { text: short, size, lines: 1 }
  }

  const breaks = naturalBreaks(short)
  for (const size of SIZE_ORDER) {
    const split = splitTwo(short, size, widthUnits, breaks)
    if (split !== null) return { text: split, size, lines: 2 }
  }

  const anyBreaks = Array.from({ length: Math.max(0, short.length - 1) }, (_, offset) => offset + 1)
  for (const size of SIZE_ORDER) {
    const split = splitTwo(short, size, widthUnits, anyBreaks)
    if (split !== null) return { text: split, size, lines: 2 }
  }

  return { text: ellipsize(short, widthUnits), size: 'xs', lines: 1 }
}
