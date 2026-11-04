import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_VERSION, parseStoredSettings } from '../../src/lib/settings/schema'
import { STORAGE_KEY, loadSettings, saveSettings, type SettingsStorage } from '../../src/lib/settings/storage'

/** In-memory storage that can be told to fail. */
class MemoryStorage implements SettingsStorage {
  values = new Map<string, string>()
  failRead = false
  failWrite = false
  getItem(key: string): string | null {
    if (this.failRead) throw new Error('blocked')
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('quota')
    this.values.set(key, value)
  }
}

function withStored(text: string): MemoryStorage {
  const storage = new MemoryStorage()
  storage.values.set(STORAGE_KEY, text)
  return storage
}

describe('loading settings', () => {
  it('returns defaults when storage is missing or empty', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('returns defaults for corrupted JSON, wrong shapes and blocked storage', () => {
    expect(loadSettings(withStored('{not json'))).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(withStored('"hello"'))).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(withStored('null'))).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(withStored('[1, 2]'))).toEqual(DEFAULT_SETTINGS)
    const blocked = new MemoryStorage()
    blocked.failRead = true
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS)
  })

  it('returns defaults for a version this build does not know', () => {
    const future = JSON.stringify({ version: 99, settings: { navigation: { scheme: 'vim' } } })
    expect(loadSettings(withStored(future))).toEqual(DEFAULT_SETTINGS)
  })

  it('replaces invalid fields one at a time and keeps the valid ones', () => {
    const broken = JSON.stringify({
      version: 1,
      settings: {
        navigation: {
          scheme: 'dvorak',
          arrowsAlwaysOn: false,
          wrap: 'yes',
          custom: { left: ['x y'], bogus: ['a'], up: 'nope', right: [''] },
        },
      },
    })
    const loaded = loadSettings(withStored(broken))
    expect(loaded.navigation).toEqual({
      scheme: 'arrows',
      arrowsAlwaysOn: false,
      wrap: false,
      custom: { left: ['x y'], right: [] },
    })
  })

  it('migrates a v1 envelope to v2 by adding the platform setting as auto', () => {
    expect(SETTINGS_VERSION).toBe(2)
    const v1 = JSON.stringify({
      version: 1,
      settings: { navigation: { scheme: 'emacs', wrap: true } },
    })
    const loaded = loadSettings(withStored(v1))
    expect(loaded.platform).toBe('auto')
    expect(loaded.navigation).toMatchObject({ scheme: 'emacs', wrap: true })
  })

  it('keeps a stored platform through the v2 envelope and replaces unknown values', () => {
    const v2 = JSON.stringify({ version: 2, settings: { platform: 'windows' } })
    expect(loadSettings(withStored(v2)).platform).toBe('windows')
    const bogus = JSON.stringify({ version: 2, settings: { platform: 'amiga' } })
    expect(loadSettings(withStored(bogus)).platform).toBe('auto')
  })

  it('migrates the unversioned v0 layout into the current envelope', () => {
    const v0 = JSON.stringify({ navigation: { scheme: 'vim', wrap: true } })
    expect(loadSettings(withStored(v0)).navigation.scheme).toBe('vim')
    const flat = JSON.stringify({ scheme: 'emacs', arrowsAlwaysOn: false })
    const loaded = parseStoredSettings(JSON.parse(flat))
    expect(loaded.navigation).toMatchObject({ scheme: 'emacs', arrowsAlwaysOn: false, wrap: false })
  })

  it('defaults a missing navigation section without touching the shared defaults', () => {
    const loaded = parseStoredSettings({ version: SETTINGS_VERSION, settings: {} })
    expect(loaded).toEqual(DEFAULT_SETTINGS)
    loaded.navigation.wrap = true
    expect(DEFAULT_SETTINGS.navigation.wrap).toBe(false)
  })
})

describe('saving settings', () => {
  it('writes a versioned envelope and reads back the same settings', () => {
    const storage = new MemoryStorage()
    const settings = {
      navigation: {
        scheme: 'vim' as const,
        arrowsAlwaysOn: false,
        wrap: true,
        custom: { edit: ['e'] },
      },
      platform: 'mac' as const,
    }
    expect(saveSettings(settings, storage)).toBe(true)
    const stored = JSON.parse(storage.values.get(STORAGE_KEY)!)
    expect(stored.version).toBe(SETTINGS_VERSION)
    expect(loadSettings(storage)).toEqual(settings)
  })

  it('reports failure instead of throwing when storage refuses the write', () => {
    const storage = new MemoryStorage()
    storage.failWrite = true
    expect(saveSettings(DEFAULT_SETTINGS, storage)).toBe(false)
    expect(saveSettings(DEFAULT_SETTINGS, null)).toBe(false)
  })
})
