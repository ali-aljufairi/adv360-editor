import { describe, expect, it } from 'vitest'
import { spellKey, usageOf } from '../../src/lib/keycodes/catalog'
import {
  buildBinding,
  collectPreferredNames,
  formatBinding,
  type Draft,
} from '../../src/lib/keycodes/binding'

/** A keymap that writes Left Shift as LSHFT and Backspace as BACKSPACE. */
const KEYMAP = [
  { behavior: '&kp', params: ['LSHFT'] },
  { behavior: '&kp', params: ['BACKSPACE'] },
  { behavior: '&kp', params: ['LC(LSHFT)'] },
]

describe('collecting preferred spellings from a keymap', () => {
  const names = collectPreferredNames(KEYMAP)

  it('maps each used key to the spelling the keymap uses', () => {
    expect(names[String(usageOf('LSHIFT'))]).toBe('LSHFT')
    expect(names[String(usageOf('BSPC'))]).toBe('BACKSPACE')
  })

  it('reads keys inside modifier wrappers and hold-tap parameters', () => {
    const holdTap = collectPreferredNames([{ behavior: '&mt', params: ['LEFT_ALT', 'LC(A)'] }])
    expect(holdTap[String(usageOf('LALT'))]).toBe('LEFT_ALT')
    expect(holdTap[String(usageOf('A'))]).toBe('A')
  })

  it('picks the most frequent spelling, and the first seen on a tie', () => {
    const counted = collectPreferredNames([
      { behavior: '&kp', params: ['LEFT_SHIFT'] },
      { behavior: '&kp', params: ['LSHFT'] },
      { behavior: '&kp', params: ['LSHFT'] },
    ])
    expect(counted[String(usageOf('LSHIFT'))]).toBe('LSHFT')
    const tied = collectPreferredNames([
      { behavior: '&kp', params: ['LCTL'] },
      { behavior: '&kp', params: ['LCTRL'] },
    ])
    expect(tied[String(usageOf('LCTRL'))]).toBe('LCTL')
  })

  it('ignores numbers, behaviors and names the firmware does not define', () => {
    const none = collectPreferredNames([
      { behavior: '&mo', params: ['2'] },
      { behavior: '&bt', params: ['BT_SEL', '0'] },
      { behavior: '&kp', params: ['KANA'] },
    ])
    expect(Object.keys(none)).toEqual([])
  })
})

describe('writing a key with the user spelling', () => {
  const names = collectPreferredNames(KEYMAP)

  it('writes &kp LSHFT when the keymap prefers LSHFT and Left Shift is picked', () => {
    const draft: Draft = {
      mode: 'single',
      choice: { kind: 'key', code: 'LSHIFT' },
      mods: [],
    }
    const binding = buildBinding(draft, names)
    expect(binding && formatBinding(binding)).toBe('&kp LSHFT')
  })

  it('writes BACKSPACE for backspace when the keymap uses that spelling', () => {
    expect(spellKey('BACKSPACE', names)).toBe('BACKSPACE')
    expect(spellKey('BSPC', names)).toBe('BACKSPACE')
  })

  it('keeps the catalog canonical spelling when the keymap has no preference', () => {
    expect(spellKey('LSHIFT', {})).toBe('LSHIFT')
    expect(spellKey('NUHS', names)).toBe('NUHS')
  })

  it('applies the user spelling inside wrappers and hold-tap slots', () => {
    const wrapped = buildBinding(
      { mode: 'single', choice: { kind: 'key', code: 'LSHIFT' }, mods: ['LC', 'LS'] },
      names,
    )
    expect(wrapped && formatBinding(wrapped)).toBe('&kp LC(LS(LSHFT))')
    const holdTap = buildBinding(
      {
        mode: 'hold',
        behavior: '&mt',
        tap: { kind: 'key', code: 'A' },
        hold: { kind: 'key', code: 'LSHIFT' },
        mods: [],
      },
      names,
    )
    expect(holdTap && formatBinding(holdTap)).toBe('&mt LSHFT A')
  })

  it('treats the spellings as one key: both name the same usage', () => {
    expect(usageOf('LSHFT')).toBe(usageOf('LSHIFT'))
    expect(usageOf('BACKSPACE')).toBe(usageOf('BKSP'))
  })
})
