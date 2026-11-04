import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { presets, resolveTheme } from './catalog'
import { fromOpenCode } from './opencode'
import { applyTokens, resolvePreference, serializePreference } from './runtime'
import type { ThemePreference } from './runtime'
import type { ThemeDef } from './tokens'

type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
  presets: ThemeDef[]
  preview: (id: string) => void
  commit: () => void
  importCustom: (theme: ThemeDef) => void
  active: ThemeDef
}
const ThemeContext = createContext<ThemeContextValue | null>(null)
export function ThemeProvider({
  initial,
  children,
}: {
  initial: ThemePreference
  children: ReactNode
}) {
  const [preference, setPref] = useState(initial),
    [previewId, setPreview] = useState<string | null>(null),
    [system, setSystem] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystem(media.matches ? 'dark' : 'light')
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const mode = preference.mode === 'system' ? system : preference.mode
  const shown = previewId ? { ...preference, [mode]: previewId } : preference
  const resolved = resolvePreference(shown, system)
  useEffect(() => {
    const current = resolvePreference(
      shown,
      matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    )
    applyTokens(current.tokens, current.mode)
  }, [shown.light, shown.dark, shown.mode, shown.custom, system])
  const persist = (next: ThemePreference) => {
    setPref(next)
    setPreview(null)
    try {
      localStorage.setItem('theme-preference', JSON.stringify(next))
    } catch {
      /* storage may be unavailable */
    }
    try {
      document.cookie = `theme-preference=${serializePreference(next)}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch {
      /* cookies may be unavailable */
    }
  }
  const value: ThemeContextValue = {
    preference,
    setPreference: persist,
    presets: [...presets, ...(preference.custom || [])],
    preview: setPreview,
    commit: () => {
      if (previewId) persist({ ...preference, [mode]: previewId })
    },
    importCustom: (theme) => {
      if (!theme.id || !theme.name || !['terminal', 'semantic'].includes(theme.type))
        throw new Error('Invalid theme')
      const base = resolveTheme(presets[0], mode)
      if (theme.type === 'semantic') {
        const result = fromOpenCode(theme, mode, base, presets[0].palette?.ansi)
        if (result.unknown.length)
          throw new Error(`Unknown theme keys: ${result.unknown.join(', ')}`)
        fromOpenCode(theme, mode === 'dark' ? 'light' : 'dark', base, presets[0].palette?.ansi)
      } else {
        if (!theme.palette) throw new Error('Missing palette')
        resolveTheme(theme, mode)
      }
      persist({
        ...preference,
        custom: [...(preference.custom || []).filter((item) => item.id !== theme.id), theme],
        [mode]: theme.id,
      })
    },
    active: resolved.theme,
  }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme requires ThemeProvider')
  return value
}
