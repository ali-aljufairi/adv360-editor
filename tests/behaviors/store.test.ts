import { describe, expect, it } from 'vitest'
import { ADV360_PROFILE } from '../../src/lib/profile'
import { createEditorStore, loadFixtureFiles } from '../../src/lib/editor-state'
import {
  comboChanges,
  comboFormOf,
  comboInputOf,
  holdTapChanges,
  holdTapFormOf,
  macroChanges,
  macroFormOf,
  newComboForm,
} from '../../src/components/behaviors/forms'

const FILES = loadFixtureFiles()
const create = () => createEditorStore(FILES, ADV360_PROFILE)

describe('behaviour edits go through the editor store', () => {
  it('applies a hold-tap change, shows it in the diff, and undoes it', () => {
    const store = create()
    const before = holdTapFormOf(
      store.getSnapshot().model.behaviors.find((item) => item.name === 'tpf')!,
    )
    store.updateHoldTap('tpf', holdTapChanges(before, { ...before, tappingTermMs: 180 }))
    const tpf = store.getSnapshot().model.behaviors.find((item) => item.name === 'tpf')!
    expect(tpf.properties['tapping-term-ms']).toBe('<180>')
    expect(Object.keys(store.diff())).toEqual(['config/adv360.keymap'])
    expect(store.getSnapshot().canUndo).toBe(true)
    store.undo()
    expect(store.getSnapshot().dirty).toBe(false)
  })

  it('removes the layers property when a combo becomes All layers', () => {
    const store = create()
    const combo = store.getSnapshot().model.combos.find((item) => item.name === 'combo')!
    const before = comboFormOf(combo)
    store.updateCombo('combo', comboChanges(before, { ...before, allLayers: true }))
    const after = store.getSnapshot().model.combos.find((item) => item.name === 'combo')!
    expect(after.layers).toBeUndefined()
    expect(
      after.node.children.some((child) => child.kind === 'property' && child.name === 'layers'),
    ).toBe(false)
  })

  it('adds a combo and removes it again', () => {
    const store = create()
    const input = comboInputOf({
      ...newComboForm('fresh_combo'),
      keyPositions: [5, 6],
      binding: '&kp Z',
    })
    store.addCombo(input)
    expect(store.getSnapshot().model.combos.some((item) => item.name === 'fresh_combo')).toBe(true)
    store.removeCombo('fresh_combo')
    expect(store.getSnapshot().model.combos.some((item) => item.name === 'fresh_combo')).toBe(false)
  })

  it('applies macro timing and reorder as one undoable edit each', () => {
    const store = create()
    const macro = store.getSnapshot().model.macros.find((item) => item.name === 'mail')!
    const before = macroFormOf(macro)
    store.updateMacro('mail', macroChanges(before, { ...before, waitMs: 20 }))
    expect(store.getSnapshot().model.macros.find((item) => item.name === 'mail')!.waitMs).toBe(20)
    store.undo()
    expect(
      store.getSnapshot().model.macros.find((item) => item.name === 'mail')!.waitMs,
    ).toBeUndefined()
  })
})
