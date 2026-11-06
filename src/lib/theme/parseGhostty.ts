import { parseColor, toHex } from './color'
import type { TerminalPalette } from './tokens'
/** Extract color settings only; unrelated Ghostty settings are ignored. */
export function parseGhostty(text: string): TerminalPalette {
  const values: Record<string, string> = {},
    ansi: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const value353 = /^\s*([\w-]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!value353 || line.trimStart().startsWith('#')) continue
    if (value353[1] === 'palette') {
      const value519 = /^(\d+)\s*=\s*(.+)$/.exec(value353[2])
      if (value519 && +value519[1] < 16) ansi[+value519[1]] = toHex(parseColor(value519[2]))
    } else if (
      [
        'background',
        'foreground',
        'cursor-color',
        'selection-background',
        'selection-foreground',
      ].includes(value353[1])
    )
      values[value353[1]] = toHex(parseColor(value353[2]))
  }
  if (!values.background || !values.foreground)
    throw new Error('Background and foreground are required')
  return {
    background: values.background,
    foreground: values.foreground,
    cursor: values['cursor-color'],
    selection: values['selection-background'],
    selectionForeground: values['selection-foreground'],
    ansi: Array.from({ length: 16 }, (_, i) => ansi[i] || values.foreground),
  }
}
