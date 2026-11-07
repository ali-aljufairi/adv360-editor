import { describe, expect, it } from 'vitest'
import { createEditorStore, loadFixtureFiles } from '../../src/lib/editor-state'
import { ADV360_PROFILE } from '../../src/lib/profile'

const make = () => createEditorStore(loadFixtureFiles(), ADV360_PROFILE)
describe('batch editing', () => {
  it.each([
    [
      'paste',
      (s: ReturnType<typeof make>) => {
        s.copyBindings([0, 2])
        s.pasteBindings(4)
      },
    ],
    ['swap', (s: ReturnType<typeof make>) => s.swapKeys(0, 2)],
    ['cross-layer swap', (s: ReturnType<typeof make>) => s.swapKeysAcrossLayers(1, 0, 1)],
    ['assign', (s: ReturnType<typeof make>) => s.assignToMany([0, 2], '&kp Z')],
    ['copy layer', (s: ReturnType<typeof make>) => s.copyLayer(0, 1)],
    ['clear', (s: ReturnType<typeof make>) => s.clearKeys([0, 2])],
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
    const s = make(),
      before = s.getSnapshot().files[ADV360_PROFILE.keymap.path].split('\n')
    s.assignToMany([0, 1], '&kp Z')
    const after = s.getSnapshot().files[ADV360_PROFILE.keymap.path].split('\n')
    expect(after.length).toBe(before.length)
    expect(after.filter((line, index) => line !== before[index])).toHaveLength(1)
  })
  it('selects ranges, toggles, resets on layer change, and retains single selection', () => {
    const s = make()
    s.selectKey(2)
    s.selectRange(5)
    expect([...s.getSnapshot().selectedKeys]).toEqual([2, 3, 4, 5])
    s.toggleKey(3)
    expect(s.getSnapshot().selectedKeys.has(3)).toBe(false)
    s.setActiveLayer(1)
    expect(s.getSnapshot().selectedKeys.size).toBe(0)
    s.clearSelection()
    expect(s.getSnapshot().selectedKey).toBeNull()
  })
  it('reports skipped paste positions and keeps clipboard across layers', () => {
    const s = make()
    s.copyBindings([0, 2])
    s.setActiveLayer(1)
    expect(s.pasteBindings(75)).toEqual({ pasted: [75], skipped: [77] })
  })
  it('validates atomically and uses the proper clear binding', () => {
    const s = make(),
      before = s.getSnapshot().files
    expect(() => s.assignToMany([0, 1000], '&kp A')).toThrow()
    expect(() => s.assignToMany([0, 1], 'invalid')).toThrow()
    expect(s.getSnapshot().files).toEqual(before)
    s.clearKeys([0])
    expect(s.getSnapshot().model.layers[0].bindings[0].text).toBe('&none')
    s.setActiveLayer(1)
    s.clearKeys([0])
    expect(s.getSnapshot().model.layers[1].bindings[0].text).toBe('&trans')
  })
})
