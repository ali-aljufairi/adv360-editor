import { describe, expect, it } from 'vitest'
import { KEY_OVERLAY, resolveKeyCode } from '../../src/lib/keycodes/catalog'
import data from '../../src/lib/keycodes/zmk-keys.generated.json'

describe('firmware key definitions', () => {
  const labels = data.labels as Record<string, string>
  it('contains every overlay name and alias', () => {
    for (const entry of KEY_OVERLAY)
      for (const name of [entry.code, ...entry.aliases]) expect(data.values).toHaveProperty(name)
  })
  it('resolves all header names and rejects unknown names', () => {
    for (const name of Object.keys(data.values)) expect(resolveKeyCode(name), name).toBeDefined()
    for (const name of [
      'INT_KATAKANAHIRAGANA',
      'K_MENU',
      ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
    ])
      expect(resolveKeyCode(name)).toBeDefined()
    expect(resolveKeyCode('NOT_A_REAL_KEY')).toBeUndefined()
    expect(resolveKeyCode('LSHFT')).toBe(resolveKeyCode('LEFT_SHIFT'))
    expect(resolveKeyCode('N1')).toBe(resolveKeyCode('NUMBER_1'))
  })

  it('labels every generated spelling with a human label or an explicit raw fallback', () => {
    for (const name of Object.keys(data.values)) {
      expect(labels[name], name).toBeTruthy()
      const key = resolveKeyCode(name)
      expect(key?.label || key?.rawFallback, name).toBeTruthy()
    }
  })
})
