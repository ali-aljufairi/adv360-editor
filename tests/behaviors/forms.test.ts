import { describe, expect, it } from 'vitest'
import { formatBinding, resolve } from '../../src/lib/zmk'
import type { Model } from '../../src/lib/zmk'
import { loadFixtureFiles } from '../../src/lib/editor-state'
import {
  FLAVORS,
  balanced,
  changedOnly,
  comboChanges,
  comboFormOf,
  comboInputOf,
  comboProblems,
  holdTapChanges,
  holdTapFormOf,
  holdTapProblems,
  isBindingText,
  isKeyText,
  keysUsing,
  macroBindingsOf,
  macroChanges,
  macroFormOf,
  macroOpaqueReason,
  macroPreview,
  macroProblems,
  macroStepsOf,
  moveItem,
  newComboForm,
  stepFrom,
  stepProblem,
  stepText,
  toggleIndex,
} from '../../src/components/behaviors/forms'

const fixture = resolve(loadFixtureFiles(), 'config/adv360.keymap')
const named = (model: Model, name: string) => {
  const found = [...model.behaviors, ...model.macros].find((item) => item.name === name)
  if (!found) throw new Error(`fixture is missing ${name}`)
  return found
}
const comboNamed = (model: Model, name: string) => {
  const found = model.combos.find((item) => item.name === name)
  if (!found) throw new Error(`fixture is missing combo ${name}`)
  return found
}
const SHOUT = `/ {
    macros {
        shout: shout {
            compatible = "zmk,behavior-macro";
            #binding-cells = <0>;
            bindings = <&macro_press &kp LSHIFT &macro_tap &kp A &macro_release &kp LSHIFT &macro_wait_time 40 &kp B>;
            wait-ms = <30>;
            tap-ms = <12>;
        };
        broken: broken {
            compatible = "zmk,behavior-macro";
            #binding-cells = <0>;
            bindings = <&kp A MACRO_PLACEHOLDER>;
        };
    };
};
`
const shoutModel = resolve({ 'shout.keymap': SHOUT }, 'shout.keymap')

describe('hold-taps', () => {
  it('reads the fixture tpf into form values, defaulting the flavor to balanced', () => {
    const form = holdTapFormOf(named(fixture, 'tpf'))
    expect(form.flavor).toBe('balanced')
    expect(form.tappingTermMs).toBe(200)
    expect(form.quickTapMs).toBeUndefined()
    expect(form.holdTriggerKeyPositions).toEqual([1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 27])
  })

  it('writes only the fields that changed', () => {
    const before = holdTapFormOf(named(fixture, 'tpf'))
    const after = { ...before, tappingTermMs: 180 }
    expect(holdTapChanges(before, after)).toEqual({ tappingTermMs: 180 })
    expect(holdTapChanges(before, before)).toEqual({})
  })

  it('offers the four ZMK flavors, each with an explanation', () => {
    expect(FLAVORS.map((flavor) => flavor.value)).toEqual([
      'balanced',
      'tap-preferred',
      'hold-preferred',
      'tap-unless-interrupted',
    ])
    for (const flavor of FLAVORS) expect(flavor.help.length).toBeGreaterThan(20)
  })

  it('flags out-of-range values and permits clearing optional values', () => {
    const before = holdTapFormOf(named(fixture, 'tpf'))
    expect(holdTapProblems({ ...before, tappingTermMs: 0 }, 62)).toHaveProperty('tappingTermMs')
    expect(holdTapProblems({ ...before, holdTriggerKeyPositions: [62] }, 62)).toHaveProperty(
      'holdTriggerKeyPositions',
    )
    expect(holdTapProblems(before, 62)).toEqual({})
    const withQuick = { ...before, quickTapMs: 150 }
    expect(holdTapProblems({ ...before, quickTapMs: undefined }, 62, withQuick)).toEqual({})
    expect(holdTapChanges(withQuick, before).quickTapMs).toBeNull()
  })

  it('finds every key that uses the hold-tap', () => {
    const sites = keysUsing(fixture, ['tpf', 'TPF'])
    expect(sites.length).toBeGreaterThan(0)
    expect(sites.every((site) => site.text.startsWith('&tpf'))).toBe(true)
  })
})

describe('macros', () => {
  it('turns press, release, tap and wait bindings into ordered steps', () => {
    const steps = macroStepsOf(named(shoutModel, 'shout').bindings)
    expect(steps).toEqual([
      { kind: 'press', key: 'LSHIFT' },
      { kind: 'tap', key: 'A' },
      { kind: 'release', key: 'LSHIFT' },
      { kind: 'wait', ms: 40 },
      { kind: 'release', key: 'B' },
    ])
  })

  it('writes steps back to the same bindings, with explicit mode changes', () => {
    const macro = named(shoutModel, 'shout')
    const written = macroBindingsOf(macroStepsOf(macro.bindings)).map(formatBinding)
    expect(written).toEqual([
      '&macro_press',
      '&kp LSHIFT',
      '&macro_tap',
      '&kp A',
      '&macro_release',
      '&kp LSHIFT',
      '&macro_wait_time 40',
      '&kp B',
    ])
  })

  it('keeps unknown bindings as behavior steps, so nothing is lost on write', () => {
    const steps = macroStepsOf(named(fixture, 'mail').bindings)
    expect(steps[0]).toEqual({ kind: 'behavior', text: '&none', mode: 'tap' })
    expect(steps[1]).toEqual({ kind: 'tap', key: 'M' })
    const written = macroBindingsOf(steps).map(formatBinding)
    expect(written).toEqual(named(fixture, 'mail').bindings.map((binding) => binding.text))
  })

  it('emits mode changes after reordering and carries mode across timing controls', () => {
    const steps = macroStepsOf(named(shoutModel, 'shout').bindings)
    const reordered = moveItem(steps, 1, 0)
    expect(macroBindingsOf(reordered).map(formatBinding)).toEqual([
      '&kp A',
      '&macro_press',
      '&kp LSHIFT',
      '&macro_release',
      '&kp LSHIFT',
      '&macro_wait_time 40',
      '&kp B',
    ])
    expect(
      macroChanges(macroFormOf(named(shoutModel, 'shout')), {
        ...macroFormOf(named(shoutModel, 'shout')),
        tapMs: undefined,
      }).tapMs,
    ).toBeNull()
  })

  it('marks macros with placeholders as read-only and says why', () => {
    expect(macroOpaqueReason(named(shoutModel, 'shout'))).toBeUndefined()
    expect(macroOpaqueReason(named(shoutModel, 'broken'))).toMatch(/MACRO_PLACEHOLDER/)
  })

  it('moves steps by index and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })

  it('sends only changed macro fields', () => {
    const before = macroFormOf(named(shoutModel, 'shout'))
    expect(macroChanges(before, before)).toEqual({})
    expect(macroChanges(before, { ...before, waitMs: 20 })).toEqual({ waitMs: 20 })
    const reordered = { ...before, steps: moveItem(before.steps, 0, 1) }
    expect(Object.keys(macroChanges(before, reordered))).toEqual(['bindings'])
  })

  it('describes what it types in one line', () => {
    const steps = macroStepsOf(named(shoutModel, 'shout').bindings)
    expect(macroPreview(steps, { tapMs: 12, waitMs: 30 })).toBe(
      'hold LSHIFT → A → release LSHIFT → wait 40 ms → release B (tap 12 ms, wait 30 ms between)',
    )
    expect(macroPreview([])).toBe('No steps yet.')
  })

  it('validates key text, behavior text and wait times', () => {
    expect(stepProblem({ kind: 'tap', key: 'LS(A' })).toBeDefined()
    expect(stepProblem({ kind: 'tap', key: '' })).toBeDefined()
    expect(stepProblem({ kind: 'tap', key: 'LS(LG(LA(C)))' })).toBeUndefined()
    expect(stepProblem({ kind: 'wait', ms: -1 })).toBeDefined()
    expect(stepProblem({ kind: 'behavior', text: 'kp A' })).toBeDefined()
    expect(stepProblem({ kind: 'behavior', text: '&kp A' })).toBeUndefined()
    const form = macroFormOf(named(shoutModel, 'shout'))
    expect(macroProblems({ ...form, tapMs: 20000 })).toHaveProperty('tapMs')
  })

  it('round-trips step text and creates steps from kind and text', () => {
    expect(stepText(stepFrom('wait', '25'))).toBe('25')
    expect(stepFrom('release', ' LSHIFT ')).toEqual({ kind: 'release', key: 'LSHIFT' })
  })
})

describe('combos', () => {
  it('treats a combo with no layers property as all layers', () => {
    const files = loadFixtureFiles()
    const keymap = 'config/adv360.keymap'
    files[keymap] = files[keymap].replace(
      'key-positions = <61>;\n            layers = <0>;',
      'key-positions = <61>;',
    )
    const allLayers = comboFormOf(comboNamed(resolve(files, keymap), 'combo'))
    expect(allLayers.allLayers).toBe(true)
    expect(comboInputOf(allLayers).layers).toBeUndefined()
  })

  it('keeps explicit layers and writes them back', () => {
    const form = comboFormOf(comboNamed(fixture, 'combo'))
    expect(form.allLayers).toBe(false)
    expect(form.layers).toEqual([0])
    expect(comboInputOf(form).layers).toEqual([0])
  })

  it('omits layers when All layers is chosen, so the property is removed', () => {
    const before = comboFormOf(comboNamed(fixture, 'combo'))
    const changes = comboChanges(before, { ...before, allLayers: true })
    expect(changes).toHaveProperty('layers')
    expect(changes.layers).toBeUndefined()
  })

  it('reads the slow-release switch and the prior-idle time from the node', () => {
    const form = comboFormOf(comboNamed(fixture, 'combo_studio_unlock'))
    expect(form.keyPositions).toEqual([46, 59])
    expect(form.slowRelease).toBe(false)
  })

  it('checks names, keys, bindings and layers', () => {
    const base = newComboForm('fresh')
    const context = { keyCount: 62, layerCount: 4, otherNames: ['fresh'] }
    expect(comboProblems(base, context)).toHaveProperty('name')
    expect(comboProblems({ ...base, name: 'ok' }, context)).toHaveProperty('keyPositions')
    expect(comboProblems({ ...base, name: 'ok', keyPositions: [3, 3] }, context)).toHaveProperty(
      'keyPositions',
    )
    expect(
      comboProblems({ ...base, name: 'ok', keyPositions: [3, 4], binding: 'kp A' }, context),
    ).toHaveProperty('binding')
    expect(
      comboProblems(
        { ...base, name: 'ok', keyPositions: [3, 4], allLayers: false, layers: [] },
        context,
      ),
    ).toHaveProperty('layers')
    expect(comboProblems({ ...base, name: 'ok', keyPositions: [3, 4] }, context)).toEqual({})
  })
})

describe('shared helpers', () => {
  it('keeps only changed keys', () => {
    expect(changedOnly({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 })
  })

  it('toggles key positions and keeps them sorted', () => {
    expect(toggleIndex([5, 1], 3)).toEqual([1, 3, 5])
    expect(toggleIndex([1, 3, 5], 3)).toEqual([1, 5])
  })

  it('recognises key and binding text', () => {
    expect(isKeyText('LC(LS(K))')).toBe(true)
    expect(isKeyText('LC(LS(K)')).toBe(false)
    expect(isBindingText('&studio_unlock')).toBe(true)
    expect(isBindingText('studio_unlock')).toBe(false)
    expect(balanced('(()')).toBe(false)
  })
})
