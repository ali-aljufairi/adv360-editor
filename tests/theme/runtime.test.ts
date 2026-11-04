import { expect, it } from 'vitest'
import {
  defaultPreference,
  parsePreference,
  resolvePreference,
  restorePreference,
  serializePreference,
} from '../../src/lib/theme/runtime'
it('round trips preference cookies and resolves system mode', () => {
  const value244 = { ...defaultPreference, mode: 'system' as const }
  expect(parsePreference(serializePreference(value244))).toEqual(value244)
  expect(resolvePreference(value244, 'light').theme.name).toBe('Catppuccin Latte')
  expect(resolvePreference(value244, 'dark').theme.name).toBe('Catppuccin Mocha')
  expect(parsePreference('%invalid')).toEqual(defaultPreference)
})

it('keeps cookies small with 50 imported themes and resolves the active custom theme', () => {
  const custom = Array.from({ length: 50 }, (_, index) => ({
    id: `custom:${index}`,
    name: `Theme ${index}`,
    type: 'terminal' as const,
    palette: {
      background: '#111111',
      foreground: '#eeeeee',
      ansi: Array(16).fill('#888888') as string[],
    },
  }))
  const pref = { ...defaultPreference, mode: 'dark' as const, dark: custom[49].id, custom }
  const cookie = serializePreference(pref, 'dark')
  expect(Buffer.byteLength(`theme-preference=${cookie}`)).toBeLessThan(512)
  const parsed = parsePreference(cookie)
  expect(parsed.custom).toBeUndefined()
  expect(resolvePreference(restorePreference(parsed, custom, 'dark'), 'dark').theme.id).toBe(
    custom[49].id,
  )
  expect(Object.keys(JSON.parse(decodeURIComponent(cookie))).sort()).toEqual([
    'dark',
    'hash',
    'light',
    'mode',
    'v',
  ])
})

it('repairs missing and changed active custom themes to the default', () => {
  const custom = {
    id: 'custom:test',
    name: 'Test',
    type: 'terminal' as const,
    palette: {
      background: '#111111',
      foreground: '#eeeeee',
      ansi: Array(16).fill('#888888') as string[],
    },
  }
  const cookie = serializePreference({
    ...defaultPreference,
    mode: 'dark',
    dark: custom.id,
    custom: [custom],
  })
  const parsed = parsePreference(cookie)
  for (const themes of [[], [{ ...custom, name: 'Changed' }]]) {
    const repaired = restorePreference(parsed, themes, 'dark')
    expect(repaired.dark).toBe(defaultPreference.dark)
    expect(resolvePreference(repaired, 'dark').theme.id).toBe(defaultPreference.dark)
    expect(JSON.parse(decodeURIComponent(serializePreference(repaired))).hash).toBeUndefined()
  }
})
