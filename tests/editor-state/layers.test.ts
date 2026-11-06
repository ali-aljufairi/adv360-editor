import { describe, expect, it } from 'vitest'
import { ADV360_PROFILE } from '../../src/lib/profile'
import { createEditorStore, layerNodeName, loadFixtureFiles } from '../../src/lib/editor-state'
import { parse, serialize } from '../../src/lib/zmk'
import { layerAccessOf, layerTabsOf, layerLabelOf } from '../../src/components/editor/editorModel'

const files = loadFixtureFiles()
const create = () => createEditorStore(files, ADV360_PROFILE)
const names = (store: ReturnType<typeof create>) =>
  store.getSnapshot().model.layers.map(layerLabelOf)
const roundTrips = (store: ReturnType<typeof create>) => {
  for (const [file, source] of Object.entries(store.getSnapshot().files))
    expect(serialize(parse(source, file))).toBe(source)
}

describe('layer actions', () => {
  it('derives unique node names from labels', () => {
    expect(layerNodeName('My Layer!', [])).toBe('my_layer')
    expect(layerNodeName('Keypad', ['keypad'])).toBe('keypad_2')
    expect(layerNodeName('3D', [])).toBe('layer_3d')
    expect(layerNodeName('  ', [])).toBe('layer')
  })

  it('adds an empty layer shaped like the default layer, then undo restores the bytes', () => {
    const store = create()
    const index = store.addLayer({ label: 'Gaming' })
    const state = store.getSnapshot()
    expect(index).toBe(5)
    expect(state.activeLayer).toBe(5)
    expect(names(store)).toEqual(['Default', 'Keypad', 'Mod', 'Macro', 'Windows', 'Gaming'])
    const added = state.model.layers[5]
    expect(added.name).toBe('gaming')
    expect(added.bindings).toHaveLength(76)
    expect(added.bindings.every((binding) => binding.text === '&trans')).toBe(true)
    const keymap = state.files['config/adv360.keymap']
    expect(keymap).toContain('        gaming {\n            display-name = "Gaming";\n')
    expect(keymap.slice(keymap.indexOf('gaming {'))).not.toMatch(/&trans[ \t]+\r?\n/)
    roundTrips(store)
    store.undo()
    expect(store.getSnapshot().files).toEqual(files)
  })

  it('copies another layer verbatim', () => {
    const store = create()
    store.addLayer({ label: 'Keypad copy', copyFrom: 1 })
    const layers = store.getSnapshot().model.layers
    expect(layers[5].bindings.map((binding) => binding.text)).toEqual(
      layers[1].bindings.map((binding) => binding.text),
    )
    roundTrips(store)
  })

  it('renames by inserting, then editing, display-name and escapes quotes', () => {
    const store = create()
    store.renameLayer(3, 'Media "keys"')
    expect(names(store)[3]).toBe('Media "keys"')
    expect(store.getSnapshot().files['config/adv360.keymap']).toContain(
      '        macro {\n            display-name = "Media \\"keys\\"";\n',
    )
    store.renameLayer(3, 'Media')
    expect(names(store)[3]).toBe('Media')
    roundTrips(store)
    expect(() => store.renameLayer(3, '  ')).toThrow()
  })

  it('moves a layer and renumbers references', () => {
    const store = create()
    store.moveLayer(4, 2)
    const state = store.getSnapshot()
    expect(state.activeLayer).toBe(2)
    expect(names(store)).toEqual(['Default', 'Keypad', 'Windows', 'Mod', 'Macro'])
    // Macro (now 4) toggles Windows (now 2) with key 16.
    expect(state.model.layers[4].bindings[16].text).toBe('&tog 2')
    roundTrips(store)
  })

  it('reports references, then removes a layer and fixes the active layer', () => {
    const store = create()
    const references = store.layerReferences(4)
    expect(references).toEqual([expect.objectContaining({ layer: 3, key: 16, text: '&tog 4' })])
    store.setActiveLayer(4)
    store.removeLayer(4)
    const state = store.getSnapshot()
    expect(state.model.layers).toHaveLength(4)
    expect(state.activeLayer).toBe(3)
    expect(state.model.layers[3].bindings[16].text).toBe('&none')
    roundTrips(store)
    store.undo()
    expect(store.getSnapshot().files).toEqual(files)
  })
})

describe('layer change summary', () => {
  it('reports layer-level changes instead of one line per key', () => {
    const store = create()
    store.addLayer({ label: 'Gaming' })
    expect(store.summary()).toEqual(['Added layer Gaming'])
    store.renameLayer(1, 'Numbers')
    expect(store.summary()).toEqual(['Renamed layer Keypad → Numbers', 'Added layer Gaming'])
  })

  it('lists cleared references when a layer is removed', () => {
    const store = create()
    store.removeLayer(4)
    expect(store.summary()).toEqual([
      'Removed layer Windows',
      expect.stringMatching(/^Macro · key 16 .*&tog 4 → &none$/),
    ])
  })
})

describe('layer access', () => {
  const model = create().getSnapshot().model
  const access = layerAccessOf(model)

  it('finds the Windows toggle on the Macro layer and marks Mod as unreachable', () => {
    expect(access[4]).toEqual([{ kind: 'toggle', fromLayer: 3, key: 16, text: '&tog 4' }])
    expect(access[2]).toEqual([])
    expect(access[1].length).toBeGreaterThan(0)
  })

  it('summarises how each layer is reached', () => {
    const state = create().getSnapshot()
    const tabs = layerTabsOf(state.model, state.issues)
    expect(tabs[0].summary).toMatch(/^Default layer/)
    expect(tabs[2].summary).toBe('No key reaches this layer')
    expect(tabs[2].unreachable).toBe(true)
    expect(tabs[4].summary).toBe('In Macro, toggle with W')
  })
})
