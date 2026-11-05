import { describe, expect, it } from 'vitest'
import {
  buildBinding,
  draftFromBinding,
  holdKindOf,
  holdTapSpecs,
  kindOfBinding,
  layerBinding,
  layerModeOf,
  type BindingValue,
  type HoldTapSpec,
} from '../../src/lib/keycodes/binding'
import { buildItems, describeBinding, type PickerLayer } from '../../src/components/picker/items'

const TPF: HoldTapSpec = { behavior: '&tpf', order: 'hold-tap', holdKind: 'key' }
const LT_PAD: HoldTapSpec = { behavior: '&lt_pad', order: 'tap-hold', holdKind: 'layer' }
const SPECS = holdTapSpecs([
  { label: 'tpf', order: 'hold-tap', holdKind: 'key' },
  { label: 'lt_pad', order: 'tap-hold', holdKind: 'layer' },
])

/**
 * Round-trips a binding through a draft, the way the picker does when it opens and commits.
 * @param value - The binding.
 * @returns The binding rebuilt from its draft.
 */
function roundTrip(value: BindingValue): BindingValue | null {
  return buildBinding(draftFromBinding(value, SPECS))
}

describe('kindOfBinding', () => {
  it('puts key presses and key-level behaviors on the Key tab', () => {
    expect(kindOfBinding({ behavior: '&kp', params: ['A'] })).toBe('key')
    expect(kindOfBinding({ behavior: '&sk', params: ['LSHIFT'] })).toBe('key')
  })

  it('puts built-in and custom hold-taps on the Tap/Hold tab, by param count', () => {
    expect(kindOfBinding({ behavior: '&mt', params: ['LSHIFT', 'A'] })).toBe('taphold')
    expect(kindOfBinding({ behavior: '&lt', params: ['1', 'SPACE'] })).toBe('taphold')
    expect(kindOfBinding({ behavior: '&tpf', params: ['LSHIFT', 'A'] }, { holdTaps: [TPF] })).toBe(
      'taphold',
    )
    expect(kindOfBinding({ behavior: '&tpf', params: ['LSHIFT', 'A'] })).toBe('system')
  })

  it('puts the four layer behaviors on the Layer tab', () => {
    for (const behavior of ['&mo', '&tog', '&to', '&sl']) {
      expect(kindOfBinding({ behavior, params: ['2'] })).toBe('layer')
    }
  })

  it('recognises macros by name and by the macro mode behaviors', () => {
    const context = { macros: ['&hello_world'] }
    expect(kindOfBinding({ behavior: '&hello_world', params: [] }, context)).toBe('macro')
    expect(kindOfBinding({ behavior: '&macro_tap', params: [] })).toBe('macro')
  })

  it('sorts the remaining behaviors into Bluetooth, Mouse, Empty and System', () => {
    expect(kindOfBinding({ behavior: '&bt', params: ['BT_CLR'] })).toBe('bluetooth')
    expect(kindOfBinding({ behavior: '&out', params: ['OUT_USB'] })).toBe('bluetooth')
    expect(kindOfBinding({ behavior: '&mkp', params: ['LCLK'] })).toBe('mouse')
    expect(kindOfBinding({ behavior: '&trans', params: [] })).toBe('empty')
    expect(kindOfBinding({ behavior: '&none', params: [] })).toBe('empty')
    expect(kindOfBinding({ behavior: '&bootloader', params: [] })).toBe('system')
    expect(kindOfBinding({ behavior: '&rgb_ug', params: ['RGB_TOG'] })).toBe('system')
  })
})

describe('hold-tap specs', () => {
  it('always offers mt and lt, and reads custom order and hold kind', () => {
    expect(holdTapSpecs()).toEqual([
      { behavior: '&mt', order: 'hold-tap', holdKind: 'key' },
      { behavior: '&lt', order: 'hold-tap', holdKind: 'layer' },
    ])
    expect(SPECS).toContainEqual(TPF)
    expect(SPECS).toContainEqual(LT_PAD)
  })

  it('reports what a hold-tap holds, defaulting to a key', () => {
    expect(holdKindOf('&lt', SPECS)).toBe('layer')
    expect(holdKindOf('&lt_pad', SPECS)).toBe('layer')
    expect(holdKindOf('&unknown', SPECS)).toBe('key')
  })
})

describe('hold-tap binding generation', () => {
  it('writes mt as hold then tap, with modifiers on the tap', () => {
    const binding = buildBinding({
      mode: 'hold',
      behavior: '&mt',
      tap: { kind: 'key', code: 'A' },
      hold: { kind: 'key', code: 'LSHIFT' },
      mods: ['LC'],
    })
    expect(binding).toEqual({ behavior: '&mt', params: ['LSHIFT', 'LC(A)'] })
  })

  it('writes lt with the layer number first', () => {
    const binding = buildBinding({
      mode: 'hold',
      behavior: '&lt',
      tap: { kind: 'key', code: 'SPACE' },
      hold: { kind: 'layer', layer: 1 },
      mods: [],
    })
    expect(binding).toEqual({ behavior: '&lt', params: ['1', 'SPACE'] })
  })

  it('writes a custom hold-tap in its own order', () => {
    const holdTap = buildBinding({
      mode: 'hold',
      behavior: '&tpf',
      tap: { kind: 'key', code: 'A' },
      hold: { kind: 'key', code: 'LSHIFT' },
      mods: [],
      order: 'hold-tap',
    })
    expect(holdTap).toEqual({ behavior: '&tpf', params: ['LSHIFT', 'A'] })

    const tapHold = buildBinding({
      mode: 'hold',
      behavior: '&lt_pad',
      tap: { kind: 'key', code: 'A' },
      hold: { kind: 'layer', layer: 2 },
      mods: [],
      order: 'tap-hold',
    })
    expect(tapHold).toEqual({ behavior: '&lt_pad', params: ['A', '2'] })
  })

  it('refuses an incomplete hold-tap', () => {
    expect(
      buildBinding({
        mode: 'hold',
        behavior: '&mt',
        tap: { kind: 'key', code: 'A' },
        hold: null,
        mods: [],
      }),
    ).toBeNull()
  })
})

describe('layer modes', () => {
  it('writes each mode as its own layer behavior', () => {
    expect(layerBinding('mo', 1)).toEqual({ behavior: '&mo', params: ['1'] })
    expect(layerBinding('tog', 2)).toEqual({ behavior: '&tog', params: ['2'] })
    expect(layerBinding('to', 0)).toEqual({ behavior: '&to', params: ['0'] })
    expect(layerBinding('sl', 3)).toEqual({ behavior: '&sl', params: ['3'] })
  })

  it('reads the mode and layer back, and ignores non-layer bindings', () => {
    expect(layerModeOf({ behavior: '&tog', params: ['2'] })).toEqual({ mode: 'tog', layer: 2 })
    expect(layerModeOf({ behavior: '&kp', params: ['A'] })).toBeNull()
    expect(layerModeOf({ behavior: '&mo', params: ['x'] })).toBeNull()
  })
})

describe('draft round-trips for each tab', () => {
  const cases: BindingValue[] = [
    { behavior: '&kp', params: ['LC(LS(K))'] },
    { behavior: '&kp', params: ['ESC'] },
    { behavior: '&mt', params: ['LSHIFT', 'LC(A)'] },
    { behavior: '&lt', params: ['1', 'SPACE'] },
    { behavior: '&tpf', params: ['LSHIFT', 'A'] },
    { behavior: '&lt_pad', params: ['A', '2'] },
    { behavior: '&mo', params: ['1'] },
    { behavior: '&tog', params: ['2'] },
    { behavior: '&sl', params: ['3'] },
    { behavior: '&hello_world', params: [] },
    { behavior: '&macro_tap', params: [] },
    { behavior: '&bt', params: ['BT_CLR'] },
    { behavior: '&mkp', params: ['LCLK'] },
    { behavior: '&trans', params: [] },
    { behavior: '&bootloader', params: [] },
  ]
  for (const value of cases) {
    it(`reproduces ${value.behavior} ${value.params.join(' ')}`, () => {
      expect(roundTrip(value)).toEqual(value)
    })
  }

  it('turns a layer hold-tap draft into the same binding a layer picker would write', () => {
    const fromTab = buildBinding({
      mode: 'hold',
      behavior: '&lt',
      tap: { kind: 'key', code: 'SPACE' },
      hold: { kind: 'layer', layer: 1 },
      mods: [],
    })
    expect(fromTab).toEqual({ behavior: '&lt', params: ['1', 'SPACE'] })
  })
})

describe('row tabs from buildItems', () => {
  const layers: PickerLayer[] = [
    { index: 0, name: 'Default' },
    { index: 1, name: 'Keypad' },
  ]
  const macros = [{ label: 'Hello world', name: 'hello_world' }]
  const holdTaps = [{ label: 'tpf' }]
  const items = buildItems(
    layers,
    macros,
    holdTaps,
    'windows',
    [],
    { hello_world: 'Ctrl+A, then type' },
    SPECS,
  )
  const byId = new Map(items.map((item) => [item.id, item]))

  it('lists each row under its tab', () => {
    expect(byId.get('key:A')?.tab).toBe('key')
    expect(byId.get('action:bt-clear')?.tab).toBe('bluetooth')
    expect(byId.get('action:mouse-left')?.tab).toBe('mouse')
    expect(byId.get('action:soft-off')?.tab).toBe('system')
    expect(byId.get('action:transparent')?.tab).toBe('empty')
    expect(byId.get('action:macro-tap')?.tab).toBe('macro')
    expect(byId.get('action:hold-tap')?.tab).toBe('taphold')
    expect(byId.get('layer:mo:1')?.tab).toBe('layer')
    expect(byId.get('macro:hello_world')?.tab).toBe('macro')
  })

  it('shows macro steps as the macro row note', () => {
    expect(byId.get('macro:hello_world')?.note).toBe('Ctrl+A, then type')
  })

  it('makes a custom hold-tap row take a layer when its hold kind is layer', () => {
    expect(byId.get('dual:tpf')?.dual).toEqual({ behavior: '&tpf', hold: 'key' })
    expect(byId.get('dual:tpf')?.tab).toBe('taphold')
  })
})

describe('header legend', () => {
  it('shows the friendly name for a key, not the behavior name', () => {
    expect(describeBinding({ behavior: '&kp', params: ['ESC'] }, 'windows')).toBe('Escape')
  })
})
