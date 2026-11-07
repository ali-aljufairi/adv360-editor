import { describe, expect, it } from 'vitest'
import {
  buildBinding,
  draftFromBinding,
  formatBinding,
  isValidKeyParam,
  parseBindingText,
  unwrapMods,
  wrapMods,
} from '../../src/lib/keycodes/binding'

describe('modifier wrapping', () => {
  it('returns a bare key when there are no modifiers', () => {
    expect(wrapMods('A', [])).toBe('A')
  })

  it('makes the first modifier the outermost wrapper', () => {
    expect(wrapMods('K', ['LC', 'LS'])).toBe('LC(LS(K))')
    expect(wrapMods('C', ['RG'])).toBe('RG(C)')
  })

  it('unwraps modifiers back into the bare key, outermost first', () => {
    expect(unwrapMods('LC(LS(K))')).toEqual({ code: 'K', mods: ['LC', 'LS'] })
    expect(unwrapMods('SPACE')).toEqual({ code: 'SPACE', mods: [] })
  })

  it('validates wrapped keys by their inner key', () => {
    expect(isValidKeyParam('LC(LS(K))')).toBe(true)
    expect(isValidKeyParam('LC(LS(FOO))')).toBe(false)
  })
})

describe('binding text generation', () => {
  it('builds a key press with chips applied', () => {
    const binding = buildBinding({
      mode: 'single',
      choice: { kind: 'key', code: 'K' },
      mods: ['LC', 'LS'],
    })
    expect(binding && formatBinding(binding)).toBe('&kp LC(LS(K))')
  })

  it('builds a plain key press with no modifiers', () => {
    const binding = buildBinding({ mode: 'single', choice: { kind: 'key', code: 'A' }, mods: [] })
    expect(binding && formatBinding(binding)).toBe('&kp A')
  })

  it('builds a hold-tap as hold first, then the wrapped tap key', () => {
    const binding = buildBinding({
      mode: 'hold',
      behavior: '&mt',
      tap: { kind: 'key', code: 'A' },
      hold: { kind: 'key', code: 'LSHIFT' },
      mods: ['LC'],
    })
    expect(binding && formatBinding(binding)).toBe('&mt LSHIFT LC(A)')
  })

  it('builds a layer-tap as layer first, then the tap key', () => {
    const binding = buildBinding({
      mode: 'hold',
      behavior: '&lt',
      tap: { kind: 'key', code: 'SPACE' },
      hold: { kind: 'layer', layer: 2 },
      mods: [],
    })
    expect(binding && formatBinding(binding)).toBe('&lt 2 SPACE')
  })

  it('returns null while a dual-role draft is incomplete', () => {
    expect(
      buildBinding({
        mode: 'hold',
        behavior: '&mt',
        tap: { kind: 'key', code: 'A' },
        hold: null,
        mods: [],
      }),
    ).toBeNull()
    expect(
      buildBinding({
        mode: 'hold',
        behavior: '&lt',
        tap: { kind: 'key', code: 'A' },
        hold: { kind: 'action', behavior: '&bt', params: ['BT_CLR'] },
        mods: [],
      }),
    ).toBeNull()
  })

  it('formats a binding with no parameters without a trailing space', () => {
    expect(formatBinding({ behavior: '&trans', params: [] })).toBe('&trans')
  })
})

describe('reading bindings back into the picker', () => {
  it('recovers modifiers and key from a wrapped key press', () => {
    const draft = draftFromBinding({ behavior: '&kp', params: ['LC(LS(K))'] })
    expect(draft).toEqual({
      mode: 'single',
      choice: { kind: 'key', code: 'K' },
      mods: ['LC', 'LS'],
    })
  })

  it('recovers hold and tap from a hold-tap', () => {
    const draft = draftFromBinding({ behavior: '&mt', params: ['LSHIFT', 'LC(A)'] })
    expect(draft).toEqual({
      mode: 'hold',
      behavior: '&mt',
      tap: { kind: 'key', code: 'A' },
      hold: { kind: 'key', code: 'LSHIFT' },
      mods: ['LC'],
    })
  })

  it('recovers the layer from a layer-tap', () => {
    const draft = draftFromBinding({ behavior: '&lt', params: ['1', 'SPACE'] })
    expect(draft.mode === 'hold' && draft.hold).toEqual({ kind: 'layer', layer: 1 })
  })
})

describe('raw ZMK text validation', () => {
  it('accepts well-formed bindings', () => {
    for (const text of [
      '&kp A',
      '&kp LC(LS(K))',
      '&mt LSHFT A',
      '&lt 1 SPACE',
      '&mo 2',
      '&trans',
    ]) {
      expect(parseBindingText(text).ok, text).toBe(true)
    }
  })

  it('accepts unknown behaviors such as macros and board behaviors', () => {
    const parsed = parseBindingText('&hello_world')
    expect(parsed).toEqual({ ok: true, value: { behavior: '&hello_world', params: [] } })
  })

  it('keeps unknown key names as raw bindings with an explicit warning', () => {
    expect(parseBindingText('&kp CUSTOM_KEY')).toEqual({
      ok: true,
      value: { behavior: '&kp', params: ['CUSTOM_KEY'] },
      warning: 'Unlisted key name kept as raw text; verify it is defined by an included header.',
    })
    expect(parseBindingText('&kp DE_AE', ['DE_AE'])).toEqual({
      ok: true,
      value: { behavior: '&kp', params: ['DE_AE'] },
    })
  })

  it('rejects text without a leading behavior', () => {
    const parsed = parseBindingText('kp A')
    expect(parsed.ok).toBe(false)
  })

  it('keeps unknown key names as raw text with a warning', () => {
    const parsed = parseBindingText('&kp FOO')
    expect(parsed).toMatchObject({
      ok: true,
      value: { behavior: '&kp', params: ['FOO'] },
      warning: expect.stringContaining('Unlisted key name'),
    })
  })

  it('rejects &kp without exactly one key', () => {
    expect(parseBindingText('&kp').ok).toBe(false)
    expect(parseBindingText('&kp A B').ok).toBe(false)
  })

  it('rejects a layer-tap whose layer is not a number', () => {
    expect(parseBindingText('&lt two SPACE').ok).toBe(false)
  })

  it('rejects an empty field', () => {
    expect(parseBindingText('   ').ok).toBe(false)
  })
})

it('accepts numeric raw key codes with a warning', () => {
  expect(parseBindingText('&kp 0x70004')).toMatchObject({
    ok: true,
    warning: expect.any(String),
    value: { params: ['0x70004'] },
  })
})
