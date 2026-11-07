import data from './presets.generated.json'
import { fromTerminal } from './fromTerminal'
import { fromOpenCode } from './opencode'
import { ensureContrast } from './color'
import type { Mode, ThemeDef, Tokens } from './tokens'

/** Lowest contrast ratio for body text against any surface (WCAG AA). */
const TEXT_CONTRAST = 4.5
/** Text tokens that must stay readable on every surface. */
const textTokens = ['text-primary', 'text-secondary', 'text-muted'] as const
/** Surfaces the text sits on, in the order the UI layers them. */
const surfaceTokens = [
  'surface-canvas',
  'surface-panel',
  'surface-raised',
  'surface-hover',
] as const
export const presets = data as ThemeDef[]
/**
 *
 */
export function resolveTheme(theme: ThemeDef, mode: Mode): Tokens {
  const fallback = presets.find(
    (value346) => value346.id === `ghostty:catppuccin-${mode === 'dark' ? 'mocha' : 'latte'}`,
  )!
  const base = fromTerminal(theme.palette || fallback.palette!)
  const tokens =
    theme.type === 'semantic'
      ? fromOpenCode(theme, mode, base, fallback.palette!.ansi).tokens
      : base
  return withTextContrast(tokens)
}

/**
 * Pushes each text token toward black or white until it reaches the contrast floor on every
 * surface. Muted and secondary text is otherwise often too faint on the raised and hover rows.
 * @param tokens - The resolved tokens from a preset.
 * @returns A copy of the tokens with readable text.
 */
function withTextContrast(tokens: Tokens): Tokens {
  const out: Tokens = { ...tokens }
  for (const text of textTokens) {
    let fg = out[text]
    for (const surface of surfaceTokens) fg = ensureContrast(fg, out[surface], TEXT_CONTRAST)
    out[text] = fg
  }
  return out
}
