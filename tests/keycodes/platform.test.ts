import { describe, expect, it } from 'vitest'
import { buildItems, shortcutText } from '../../src/components/picker/items'
import { buildBinding, formatBinding } from '../../src/lib/keycodes/binding'
import {
  detectPlatform,
  isPlatformSetting,
  resolvePlatform,
  shortcutModId,
  type ResolvedPlatform,
} from '../../src/lib/keycodes/platform'

/** Writes the binding a picker row produces for a platform, as keymap text. */
function rowBinding(id: string, platform: ResolvedPlatform): string | undefined {
  const item = buildItems([], [], [], platform).find((row) => row.id === `action:${id}`)
  if (!item?.choice) return undefined
  const binding = buildBinding({ mode: 'single', choice: item.choice, mods: [] })
  return binding ? formatBinding(binding) : undefined
}

describe('platform shortcut recipes', () => {
  it('writes Copy as LG(C) on mac', () => {
    expect(rowBinding('copy', 'mac')).toBe('&kp LG(C)')
  })

  it('writes Copy as LC(C) on windows and linux', () => {
    expect(rowBinding('copy', 'windows')).toBe('&kp LC(C)')
    expect(rowBinding('copy', 'linux')).toBe('&kp LC(C)')
  })

  it('keeps Shift inside the command modifier for Redo', () => {
    expect(rowBinding('redo', 'mac')).toBe('&kp LG(LS(Z))')
    expect(rowBinding('redo', 'windows')).toBe('&kp LC(LS(Z))')
  })

  it('offers Save and Find as shortcuts on every platform', () => {
    expect(rowBinding('save', 'mac')).toBe('&kp LG(S)')
    expect(rowBinding('find', 'windows')).toBe('&kp LC(F)')
  })

  it('shows the platform glyph in the row: ⌘C on mac, Ctrl+C elsewhere', () => {
    expect(shortcutText('C', false, 'mac')).toBe('⌘C')
    expect(shortcutText('C', false, 'windows')).toBe('Ctrl+C')
    expect(shortcutText('Z', true, 'mac')).toBe('⇧⌘Z')
    expect(shortcutText('Z', true, 'linux')).toBe('Ctrl+Shift+Z')
    const copy = buildItems([], [], [], 'mac').find((row) => row.id === 'action:copy')
    expect(copy?.code).toBe('⌘C')
  })

  it('ignores the user modifier chips for a shortcut, which keeps its own modifiers', () => {
    const copy = buildItems([], [], [], 'mac').find((row) => row.id === 'action:copy')
    expect(copy?.choice).toBeDefined()
    const binding = buildBinding({
      mode: 'single',
      choice: copy?.choice ?? null,
      mods: ['LS'],
    })
    expect(binding && formatBinding(binding)).toBe('&kp LG(C)')
  })
})

describe('platform detection', () => {
  it('detects mac from the navigator platform or user agent', () => {
    expect(detectPlatform({ platform: 'MacIntel' })).toBe('mac')
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' })).toBe(
      'mac',
    )
  })

  it('detects windows and falls back to linux for everything else', () => {
    expect(detectPlatform({ platform: 'Win32' })).toBe('windows')
    expect(detectPlatform({ platform: 'Linux x86_64' })).toBe('linux')
    expect(detectPlatform({})).toBe('linux')
  })

  it('resolves auto through the navigator and leaves explicit choices alone', () => {
    expect(resolvePlatform('auto', { platform: 'MacIntel' })).toBe('mac')
    expect(resolvePlatform('windows', { platform: 'MacIntel' })).toBe('windows')
  })

  it('picks the command modifier from the platform', () => {
    expect(shortcutModId('mac')).toBe('LG')
    expect(shortcutModId('linux')).toBe('LC')
  })

  it('accepts only the four stored platform names', () => {
    expect(['auto', 'mac', 'windows', 'linux'].every(isPlatformSetting)).toBe(true)
    expect(isPlatformSetting('amiga')).toBe(false)
    expect(isPlatformSetting(undefined)).toBe(false)
  })
})
