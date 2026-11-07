import { describe, expect, it } from 'vitest'
import { createEditorStore, loadFixtureFiles } from '../../src/lib/editor-state'
import { ADV360_PROFILE } from '../../src/lib/profile'

const make = () => createEditorStore(loadFixtureFiles(), ADV360_PROFILE)
describe('batch editing', () => {
  it.each([
    [
      'paste',
      (store: ReturnType<typeof make>) => {
        store.copyBindings([0, 2])
        store.pasteBindings(4)
      },
    ],
    ['swap', (store: ReturnType<typeof make>) => store.swapKeys(0, 2)],
    ['cross-layer swap', (store: ReturnType<typeof make>) => store.swapKeysAcrossLayers(1, 0, 1)],
    ['assign', (store: ReturnType<typeof make>) => store.assignToMany([0, 2], '&kp Z')],
    ['copy layer', (store: ReturnType<typeof make>) => store.copyLayer(0, 1)],
    ['clear', (store: ReturnType<typeof make>) => store.clearKeys([0, 2])],
  ])('%s is one undoable operation and restores every fixture byte', (_, operation) => {
    const store = make(),
      before = store.getSnapshot().files
    operation(store)
    const after = store.getSnapshot().files
    expect(after).not.toEqual(before)
    for (const name of Object.keys(before))
      if (name !== ADV360_PROFILE.keymap.path) expect(after[name]).toBe(before[name])
    store.undo()
    expect(store.getSnapshot().files).toEqual(before)
    expect(store.getSnapshot().canUndo).toBe(false)
    store.redo()
    expect(store.getSnapshot().files).toEqual(after)
  })
  it('preserves every untouched line in the edited fixture', () => {
    const store = make(),
      before = store.getSnapshot().files[ADV360_PROFILE.keymap.path].split('\n')
    store.assignToMany([0, 1], '&kp Z')
    const after = store.getSnapshot().files[ADV360_PROFILE.keymap.path].split('\n')
    expect(after.length).toBe(before.length)
    expect(after.filter((line, index) => line !== before[index])).toHaveLength(1)
  })
  it('selects ranges, toggles, resets on layer change, and retains single selection', () => {
    const store = make()
    store.selectKey(2)
    store.selectRange(5)
    expect([...store.getSnapshot().selectedKeys]).toEqual([2, 3, 4, 5])
    store.toggleKey(3)
    expect(store.getSnapshot().selectedKeys.has(3)).toBe(false)
    store.setActiveLayer(1)
    expect(store.getSnapshot().selectedKeys.size).toBe(0)
    store.clearSelection()
    expect(store.getSnapshot().selectedKey).toBeNull()
  })
  it('reports skipped paste positions and keeps clipboard across layers', () => {
    const store = make()
    store.copyBindings([0, 2])
    store.setActiveLayer(1)
    expect(store.pasteBindings(75)).toEqual({ pasted: [75], skipped: [77] })
  })
  it('validates atomically and uses the proper clear binding', () => {
    const store = make(),
      before = store.getSnapshot().files
    expect(() => store.assignToMany([0, 1000], '&kp A')).toThrow()
    expect(() => store.assignToMany([0, 1], 'invalid')).toThrow()
    expect(store.getSnapshot().files).toEqual(before)
    store.clearKeys([0])
    expect(store.getSnapshot().model.layers[0].bindings[0].text).toBe('&none')
    store.setActiveLayer(1)
    store.clearKeys([0])
    expect(store.getSnapshot().model.layers[1].bindings[0].text).toBe('&trans')
  })
})
