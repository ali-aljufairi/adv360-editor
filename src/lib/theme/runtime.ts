import { presets, resolveTheme } from './catalog'
import type { Mode, ThemeDef, Tokens } from './tokens'

/** Theme selections and browser-only imported definitions. */
export interface ThemePreference {
  mode: 'system' | Mode
  light: string
  dark: string
  custom?: ThemeDef[]
  hash?: string
}
export const defaultPreference: ThemePreference = {
  mode: 'system',
  light: 'ghostty:catppuccin-latte',
  dark: 'ghostty:catppuccin-mocha',
}
export const customStorageKey = 'theme-custom'
/** A short deterministic fingerprint of a theme definition. */
export function themeHash(theme: ThemeDef): string {
  let hash = 2166136261
  for (const char of JSON.stringify(theme)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  }
  return (hash >>> 0).toString(36)
}
/** Parse a preference cookie, discarding any embedded definitions. */
export function parsePreference(value?: string): ThemePreference {
  try {
    const data = JSON.parse(decodeURIComponent(value || '')) as ThemePreference
    if (
      !['system', 'light', 'dark'].includes(data.mode) ||
      typeof data.light !== 'string' ||
      typeof data.dark !== 'string'
    )
      return { ...defaultPreference }
    return {
      mode: data.mode,
      light: data.light,
      dark: data.dark,
      ...(typeof data.hash === 'string' ? { hash: data.hash } : {}),
    }
  } catch {
    return { ...defaultPreference }
  }
}
/** Serialize only the version, choices, and active custom fingerprint. */
export function serializePreference(pref: ThemePreference, system: Mode = 'light'): string {
  const mode = pref.mode === 'system' ? system : pref.mode
  const custom = pref.custom?.find((theme) => theme.id === pref[mode])
  const hash = custom ? themeHash(custom) : undefined
  return encodeURIComponent(
    JSON.stringify({
      v: 1,
      mode: pref.mode,
      light: pref.light,
      dark: pref.dark,
      ...(hash ? { hash } : {}),
    }),
  )
}
/** Resolve a preference and effective system mode into a theme. */
export function resolvePreference(
  pref: ThemePreference,
  system: Mode,
): { mode: Mode; theme: ThemeDef; tokens: Tokens } {
  const mode = pref.mode === 'system' ? system : pref.mode
  const theme =
    [...(pref.custom || []), ...presets].find((item) => item.id === pref[mode]) ||
    presets.find((item) => item.id === defaultPreference[mode])!
  try {
    return { mode, theme, tokens: resolveTheme(theme, mode) }
  } catch {
    const fallback = presets.find((item) => item.id === defaultPreference[mode])!
    return { mode, theme: fallback, tokens: resolveTheme(fallback, mode) }
  }
}
/** Restore definitions only when the active custom fingerprint matches. */
export function restorePreference(
  pref: ThemePreference,
  custom: ThemeDef[],
  system: Mode,
): ThemePreference {
  const mode = pref.mode === 'system' ? system : pref.mode
  const activePreset = presets.some((item) => item.id === pref[mode])
  const active = custom.find((item) => item.id === pref[mode])
  const valid =
    active &&
    pref.hash === themeHash(active) &&
    resolvePreference({ ...pref, custom: [active] }, system).theme.id === active.id
  return {
    ...pref,
    [mode]: activePreset || valid ? pref[mode] : defaultPreference[mode],
    custom,
    hash: undefined,
  }
}
/** Apply resolved semantic variables to the document root. */
export function applyTokens(tokens: Tokens, mode: Mode): void {
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(`--${key}`, value)
}
