import { useSettings } from '../../lib/settings/context'
import type { Settings } from '../../lib/settings/schema'

/**
 * Reads settings when a SettingsProvider is mounted above the picker, and returns null when none
 * is. `useSettings` calls `useContext` before it throws, so the hook order is the same either way.
 * @returns The current settings, or null outside a provider.
 */
export function useOptionalSettings(): Settings | null {
  try {
    return useSettings().settings
  } catch {
    return null
  }
}
