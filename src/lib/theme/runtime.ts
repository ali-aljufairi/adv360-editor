import { presets, resolveTheme } from './catalog'
import type { Mode, ThemeDef, Tokens } from './tokens'
/**
 *
 */
export interface ThemePreference {
  mode: 'system' | Mode
  light: string
  dark: string
  custom?: ThemeDef[]
}
export const defaultPreference: ThemePreference = {
  mode: 'system',
  light: 'ghostty:catppuccin-latte',
  dark: 'ghostty:catppuccin-mocha',
}
/** Parse a preference cookie, falling back safely on malformed input. */
export function parsePreference(value?: string): ThemePreference {
  try {
    const data = JSON.parse(decodeURIComponent(value || '')) as ThemePreference
    if (
      !['system', 'light', 'dark'].includes(data.mode) ||
      typeof data.light !== 'string' ||
      typeof data.dark !== 'string' ||
      (data.custom && !Array.isArray(data.custom))
    )
      return { ...defaultPreference }
    return data
  } catch {
    return { ...defaultPreference }
  }
}
/** Serialize preferences for the theme cookie. */
export function serializePreference(pref: ThemePreference): string {
  return encodeURIComponent(JSON.stringify(pref))
}
/** Resolve a preference and effective system mode into a theme. */
export function resolvePreference(
  pref: ThemePreference,
  system: Mode,
): { mode: Mode; theme: ThemeDef; tokens: Tokens } {
  const mode = pref.mode === 'system' ? system : pref.mode
  const choices = [...(pref.custom || []), ...presets]
  const theme =
    choices.find((item) => item.id === pref[mode]) ||
    presets.find((item) => item.id === defaultPreference[mode])!
  try {
    return { mode, theme, tokens: resolveTheme(theme, mode) }
  } catch {
    const fallback = presets.find((item) => item.id === defaultPreference[mode])!
    return { mode, theme: fallback, tokens: resolveTheme(fallback, mode) }
  }
}
/** Apply resolved semantic variables to the document root. */
export function applyTokens(tokens: Tokens, mode: Mode): void {
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(`--${key}`, value)
}
