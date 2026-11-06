import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { NavigationSettings, Settings } from './schema'
import type { PlatformSetting } from '../keycodes/platform'
import { cloneDefaults } from './schema'
import { loadSettings, saveSettings } from './storage'

/** What components can read and change. */
export interface SettingsContextValue {
  settings: Settings
  /** Merges a patch into the navigation section and persists it. */
  updateNavigation(patch: Partial<NavigationSettings>): void
  /** Restores the navigation section to its defaults. */
  resetNavigation(): void
  /** Sets which platform's shortcuts are shown, and persists it. */
  setPlatform(platform: PlatformSetting): void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/**
 * Provides settings to the tree. Storage is read after mount, not during render, so the server
 * and the first client render agree; nothing is written until that read has happened.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => cloneDefaults())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) saveSettings(settings)
  }, [loaded, settings])

  const updateNavigation = useCallback((patch: Partial<NavigationSettings>) => {
    setSettings((current) => ({
      ...current,
      navigation: { ...current.navigation, ...patch },
    }))
  }, [])

  const resetNavigation = useCallback(() => {
    setSettings((current) => ({ ...current, navigation: cloneDefaults().navigation }))
  }, [])

  const setPlatform = useCallback((platform: PlatformSetting) => {
    setSettings((current) => ({ ...current, platform }))
  }, [])

  const value = useMemo(
    () => ({ settings, updateNavigation, resetNavigation, setPlatform }),
    [settings, updateNavigation, resetNavigation, setPlatform],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

/** Reads the nearest settings provider. Throws outside a {@link SettingsProvider}. */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside SettingsProvider')
  return value
}
