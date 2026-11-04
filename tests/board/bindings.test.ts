import { describe, expect, it } from 'vitest'
import {
  comboTag,
  layerAccentOf,
  layerTargetOf,
  legendText,
} from '../../src/components/board/bindings'
import type { Combo } from '../../src/lib/zmk/types'

function combo(values: Partial<Combo>): Combo {
  return {
    name: 'c',
    bindings: [{ behavior: '&kp', params: ['D'], text: '&kp D', editable: true, file: 'a', start: 0, end: 0 }],
    keyPositions: [1, 2],
    file: 'a',
    start: 0,
    end: 0,
    node: {} as Combo['node'],
    ...values,
  }
}

describe('layerTargetOf', () => {
  it('reads the numeric layer of layer-switching behaviors', () => {
    expect(layerTargetOf({ behavior: '&mo', params: ['2'] })).toBe(2)
    expect(layerTargetOf({ behavior: '&lt', params: ['1', 'SPACE'] })).toBe(1)
  })

  it('resolves a named layer through the layer name list', () => {
    expect(layerTargetOf({ behavior: '&tog', params: ['keypad'] }, ['default', 'keypad'])).toBe(1)
  })

  it('returns undefined for unknown names and non-switching behaviors', () => {
    expect(layerTargetOf({ behavior: '&tog', params: ['missing'] }, ['default'])).toBeUndefined()
    expect(layerTargetOf({ behavior: '&kp', params: ['1'] })).toBeUndefined()
    expect(layerTargetOf({ behavior: '&mo', params: [] })).toBeUndefined()
  })
})

describe('layerAccentOf', () => {
  it('maps layers onto the four accent slots, wrapping after four', () => {
    expect([0, 1, 2, 3, 4, 5].map(layerAccentOf)).toEqual([1, 2, 3, 4, 1, 2])
  })
})

describe('legendText', () => {
  it('joins primary and secondary legends like the keycap title', () => {
    expect(legendText({ primary: 'A', secondary: 'hold', kind: 'holdtap' })).toBe('A, hold')
    expect(legendText({ primary: '', kind: 'none' })).toBe('Empty key')
  })
})

describe('comboTag', () => {
  it('labels an unconditional combo without a note', () => {
    const tag = comboTag(combo({}), {})
    expect(tag).toEqual({ label: '⋈ D', studio: false })
  })

  it('flags a Studio-guarded combo and dashes its arc', () => {
    const tag = comboTag(combo({ condition: 'CONFIG_ZMK_STUDIO' }), {})
    expect(tag.studio).toBe(true)
    expect(tag.note).toBe('Studio builds only')
  })

  it('names other conditions verbatim', () => {
    const tag = comboTag(combo({ condition: 'CONFIG_FOO' }), {})
    expect(tag.studio).toBe(false)
    expect(tag.note).toBe('Only when CONFIG_FOO')
  })
})
