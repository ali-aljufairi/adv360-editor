import { describe, expect, it } from 'vitest'
import { ACTIONS, KEYS, LAYER_ACTIONS, resolveKeyCode } from '../../src/lib/keycodes/catalog'

describe('key alias resolution', () => {
  it('resolves every spelling of left shift to LSHIFT', () => {
    for (const name of ['LSHIFT', 'LSHFT', 'LEFT_SHIFT', 'lshift']) {
      expect(resolveKeyCode(name)?.code).toBe('LSHIFT')
    }
  })

  it('resolves NUMBER_n and N<n> to the same key', () => {
    expect(resolveKeyCode('NUMBER_1')?.code).toBe('N1')
    expect(resolveKeyCode('N1')?.code).toBe('N1')
    expect(resolveKeyCode('NUMBER_0')?.code).toBe('N0')
  })

  it('resolves backspace aliases', () => {
    expect(resolveKeyCode('BSPC')?.code).toBe('BACKSPACE')
    expect(resolveKeyCode('BKSP')?.code).toBe('BACKSPACE')
  })

  it('treats KANA and LANG1 as the same key', () => {
    expect(resolveKeyCode('KANA')?.code).toBe('LANG1')
    expect(resolveKeyCode('LANG1')?.code).toBe('LANG1')
  })

  it('returns undefined for unknown names', () => {
    expect(resolveKeyCode('NOT_A_KEY')).toBeUndefined()
    expect(resolveKeyCode('')).toBeUndefined()
  })

  it('does not let any alias point at a different key than its canonical name', () => {
    for (const entry of KEYS) {
      for (const name of [entry.code, ...entry.aliases]) {
        expect(resolveKeyCode(name)?.code, name).toBe(entry.code)
      }
    }
  })

  it('has no duplicate canonical codes', () => {
    const codes = KEYS.map((entry) => entry.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('catalog coverage', () => {
  it('contains letters A–Z, digits and F1–F24', () => {
    for (let index = 0; index < 26; index += 1) {
      expect(resolveKeyCode(String.fromCharCode(65 + index))).toBeDefined()
    }
    for (let number = 1; number <= 24; number += 1) {
      expect(resolveKeyCode(`F${number}`)?.code).toBe(`F${number}`)
    }
    expect(resolveKeyCode('F25')).toBeUndefined()
  })

  it('contains Bluetooth profile selection 0–4 as &bt BT_SEL n', () => {
    for (let slot = 0; slot <= 4; slot += 1) {
      const entry = ACTIONS.find((candidate) => candidate.id === `bt-sel-${slot}`)
      expect(entry?.behavior).toBe('&bt')
      expect(entry?.params).toEqual(['BT_SEL', String(slot)])
    }
  })

  it('marks hold-tap and layer-tap as dual-role entries', () => {
    expect(ACTIONS.find((entry) => entry.id === 'hold-tap')?.hold).toBe('key')
    expect(ACTIONS.find((entry) => entry.id === 'layer-tap')?.hold).toBe('layer')
  })

  it('offers momentary, toggle, to and sticky layer behaviors', () => {
    expect(LAYER_ACTIONS.map((entry) => entry.behavior)).toEqual(['&mo', '&tog', '&to', '&sl'])
  })
})
