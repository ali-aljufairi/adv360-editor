import { parseStoredSettings, SETTINGS_VERSION, cloneDefaults, type Settings } from './schema'

/** localStorage key holding the versioned settings envelope. */
export const STORAGE_KEY = 'adv360.settings'

/** The subset of the Web Storage API that settings use. */
export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The browser's localStorage, or null when unavailable (SSR, blocked storage, private mode). */
export function browserStorage(): SettingsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Reads settings from storage. Missing storage, invalid JSON, a wrong shape or a future version
 * all yield defaults rather than an error.
 */
export function loadSettings(storage: SettingsStorage | null = browserStorage()): Settings {
  if (!storage) return cloneDefaults()
  try {
    const text = storage.getItem(STORAGE_KEY)
    if (text === null) return cloneDefaults()
    return parseStoredSettings(JSON.parse(text))
  } catch {
    return cloneDefaults()
  }
}

/** Writes the versioned envelope. Returns false if storage refused the write. */
export function saveSettings(
  settings: Settings,
  storage: SettingsStorage | null = browserStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings }))
    return true
  } catch {
    return false
  }
}
