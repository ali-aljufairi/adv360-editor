import { parseColor, toHex } from './color'
import type { TerminalPalette } from './tokens'
/** Extract color settings only; unrelated Ghostty settings are ignored. */
export function parseGhostty(text: string): TerminalPalette {
 const values: Record<string,string> = {}, ansi: string[] = []
 for (const line of text.split(/\r?\n/)) {
  const m = /^\s*([\w-]+)\s*=\s*(.*?)\s*$/.exec(line)
  if (!m || line.trimStart().startsWith('#')) continue
  if (m[1] === 'palette') { const p = /^(\d+)\s*=\s*(.+)$/.exec(m[2]); if (p && +p[1] < 16) ansi[+p[1]] = toHex(parseColor(p[2])) }
  else if (['background','foreground','cursor-color','selection-background','selection-foreground'].includes(m[1])) values[m[1]] = toHex(parseColor(m[2]))
 }
 if (!values.background || !values.foreground) throw new Error('Background and foreground are required')
 return {background:values.background,foreground:values.foreground,cursor:values['cursor-color'],selection:values['selection-background'],selectionForeground:values['selection-foreground'],ansi:Array.from({length:16},(_,i)=>ansi[i] || values.foreground)}
}
