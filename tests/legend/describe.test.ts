import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { describeBinding, describeKeycode } from '../../src/lib/legend/describe'
import { resolve } from '../../src/lib/zmk'

const bind = (behavior: string, ...params: string[]) => ({ behavior, params })
const LAYERS = ['Base', 'Nav', 'Sym']

describe('describeBinding: &kp letters, numbers and function keys', () => {
  it('maps letters to themselves as key legends', () => {
    expect(describeBinding(bind('&kp', 'A'))).toEqual({ primary: 'A', kind: 'key' })
  })

  it('maps NUMBER_n and Nn to a digit', () => {
    expect(describeBinding(bind('&kp', 'NUMBER_1')).primary).toBe('1')
    expect(describeBinding(bind('&kp', 'N7')).primary).toBe('7')
  })

  it('maps F-keys up to F24 and rejects F25', () => {
    expect(describeBinding(bind('&kp', 'F12')).primary).toBe('F12')
    expect(describeBinding(bind('&kp', 'F24')).primary).toBe('F24')
    expect(describeBinding(bind('&kp', 'F25')).kind).toBe('raw')
  })

  it('maps named keys such as SPACE and BSPC to their full words', () => {
    expect(describeBinding(bind('&kp', 'SPACE')).primary).toBe('Space')
    expect(describeBinding(bind('&kp', 'BSPC')).primary).toBe('Backspace')
    expect(describeBinding(bind('&kp', 'ESC')).primary).toBe('Escape')
  })

  it('maps arrows and navigation keys', () => {
    expect(describeBinding(bind('&kp', 'LEFT')).primary).toBe('←')
    expect(describeBinding(bind('&kp', 'PG_DN')).primary).toBe('PageDown')
    expect(describeBinding(bind('&kp', 'HOME')).primary).toBe('Home')
  })

  it('maps keypad keys to a Keypad legend', () => {
    expect(describeBinding(bind('&kp', 'KP_N1')).primary).toBe('Keypad 1')
  })

  it('maps symbols', () => {
    expect(describeBinding(bind('&kp', 'DOT')).primary).toBe('.')
    expect(describeBinding(bind('&kp', 'AT')).primary).toBe('@')
    expect(describeBinding(bind('&kp', 'EXCLAMATION')).primary).toBe('!')
  })

  it('maps bare modifier keys with their side', () => {
    expect(describeBinding(bind('&kp', 'LSHFT'))).toEqual({
      primary: 'Shift',
      secondary: 'L',
      kind: 'mod',
    })
    expect(describeBinding(bind('&kp', 'RGUI'))).toEqual({
      primary: 'Cmd',
      secondary: 'R',
      kind: 'mod',
    })
  })

  it('maps media and system consumer keys', () => {
    expect(describeBinding(bind('&kp', 'C_VOL_UP'))).toEqual({ primary: 'Vol+', kind: 'media' })
    expect(describeBinding(bind('&kp', 'C_MENU')).kind).toBe('system')
    expect(describeBinding(bind('&kp', 'K_SCREENSAVER'))).toEqual({
      primary: 'Screensaver',
      kind: 'system',
    })
  })

  it('returns a raw legend for unknown keycodes', () => {
    expect(describeBinding(bind('&kp', 'NOT_A_KEY'))).toEqual({
      primary: 'NOT_A_KEY',
      kind: 'raw',
    })
  })

  it('returns an empty none legend for &kp with no key', () => {
    expect(describeBinding(bind('&kp'))).toEqual({ primary: '', kind: 'none' })
  })
})

describe('describeBinding: modifier functions', () => {
  it('renders LS(A) as a shift glyph before the key', () => {
    expect(describeBinding(bind('&kp', 'LS(A)'))).toEqual({ primary: '⇧A', kind: 'mod' })
  })

  it('renders nested LG(LC(NUMBER_4)) as ⌘⌃4', () => {
    expect(describeBinding(bind('&kp', 'LG(LC(NUMBER_4))')).primary).toBe('⌘⌃4')
  })

  it('renders LC(SPACE) with the ctrl glyph', () => {
    expect(describeBinding(bind('&kp', 'LC(SPACE)')).primary).toBe('⌃Space')
  })

  it('renders RA() with the alt glyph', () => {
    expect(describeBinding(bind('&kp', 'RA(B)')).primary).toBe('⌥B')
  })

  it('falls back to raw text when the wrapped keycode is unknown', () => {
    expect(describeBinding(bind('&kp', 'LS(NOPE)')).kind).toBe('raw')
  })
})

describe('describeBinding: layers', () => {
  it('uses the layer name for &mo when context provides names', () => {
    expect(describeBinding(bind('&mo', '1'), { layerNames: LAYERS })).toEqual({
      primary: 'Nav',
      secondary: 'MO',
      kind: 'layer',
    })
  })

  it('falls back to L<n> without context', () => {
    expect(describeBinding(bind('&mo', '2')).primary).toBe('L2')
  })

  it('uses the verb as secondary for &tog and &to', () => {
    expect(describeBinding(bind('&tog', '2'), { layerNames: LAYERS }).secondary).toBe('TOG')
    expect(describeBinding(bind('&to', '0'), { layerNames: LAYERS }).primary).toBe('Base')
  })
})

describe('describeBinding: hold-taps', () => {
  it('shows the tap key as primary and the layer name as secondary for &lt', () => {
    expect(describeBinding(bind('&lt', '1', 'SPACE'), { layerNames: LAYERS })).toEqual({
      primary: 'Space',
      secondary: 'Nav',
      kind: 'holdtap',
    })
  })

  it('shows the tap key and the modifier for &mt', () => {
    expect(describeBinding(bind('&mt', 'LSHFT', 'A'))).toEqual({
      primary: 'A',
      secondary: 'Shift',
      kind: 'holdtap',
    })
  })

  it('shows the tap digit and the hold F-key for custom &tpf', () => {
    expect(describeBinding(bind('&tpf', 'F1', 'NUMBER_1'))).toEqual({
      primary: '1',
      secondary: 'F1',
      kind: 'holdtap',
    })
  })

  it('renders a modifier-wrapped hold action on &tpf', () => {
    expect(describeBinding(bind('&tpf', 'LG(LS(W))', 'W')).secondary).toBe('⌘⇧W')
  })
})

describe('describeBinding: bluetooth, mouse, transparent, none, macros', () => {
  it('shows BT_SEL n as BT n', () => {
    expect(describeBinding(bind('&bt', 'BT_SEL', '0'))).toEqual({
      primary: 'BT 0',
      kind: 'bluetooth',
    })
  })

  it('shows BT_CLR as BT clear', () => {
    expect(describeBinding(bind('&bt', 'BT_CLR')).primary).toBe('BT clear')
  })

  it('renders &trans as ▽ and &none as empty', () => {
    expect(describeBinding(bind('&trans'))).toEqual({ primary: '▽', kind: 'trans' })
    expect(describeBinding(bind('&none'))).toEqual({ primary: '', kind: 'none' })
  })

  it('renders mouse buttons with &mkp', () => {
    expect(describeBinding(bind('&mkp', 'MB1'))).toEqual({ primary: 'M1', kind: 'mouse' })
  })

  it('uses the supplied label for a known macro', () => {
    const ctx = { macros: { hello_world: 'Hello' } }
    expect(describeBinding(bind('&hello_world'), ctx)).toEqual({ primary: 'Hello', kind: 'macro' })
  })

  it('returns raw text for unknown behaviors', () => {
    expect(describeBinding(bind('&foo', '1', '2'))).toEqual({ primary: '&foo 1 2', kind: 'raw' })
  })

  it('does not treat prototype names as behaviors', () => {
    expect(describeBinding(bind('&constructor')).kind).toBe('raw')
  })
})

describe('describeKeycode and fixture coverage', () => {
  it('describes a bare keycode token', () => {
    expect(describeKeycode('LEFT').primary).toBe('←')
  })

  it('describes every layer-0 binding of the adv360 fixture without throwing', () => {
    const read = (name: string) => readFileSync(`fixtures/adv360/${name}`, 'utf8')
    const model = resolve(
      { 'adv360.keymap': read('adv360.keymap'), 'macros.dtsi': read('macros.dtsi') },
      'adv360.keymap',
    )
    const names = model.layers.map((layer) => layer.name)
    const legends = (model.layers[0]?.bindings ?? []).map((binding) =>
      describeBinding(binding, { layerNames: names }),
    )
    expect(legends.length).toBeGreaterThan(0)
    expect(legends.every((legend) => typeof legend.primary === 'string')).toBe(true)
  })
})
