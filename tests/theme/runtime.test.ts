import { expect, it } from 'vitest'
import {
  defaultPreference,
  parsePreference,
  resolvePreference,
  serializePreference,
} from '../../src/lib/theme/runtime'
it('round trips preference cookies and resolves system mode', () => {
  const value244 = { ...defaultPreference, mode: 'system' as const }
  expect(parsePreference(serializePreference(value244))).toEqual(value244)
  expect(resolvePreference(value244, 'light').theme.name).toBe('Catppuccin Latte')
  expect(resolvePreference(value244, 'dark').theme.name).toBe('Catppuccin Mocha')
  expect(parsePreference('%invalid')).toEqual(defaultPreference)
})
