import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { ADV360_PROFILE } from '../../src/lib/profile'
import { createEditorStore, EditorProvider, loadFixtureFiles } from '../../src/lib/editor-state'
import { sha256 } from '../../src/lib/editor-state/hash'

const files = loadFixtureFiles()
const create = () => createEditorStore(files, ADV360_PROFILE)
const binding = (store: ReturnType<typeof create>, layer = 0, key = 0) =>
  store.getSnapshot().model.layers[layer].bindings[key].text

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('editor store', () => {
  it('hashes UTF-8 with SHA-256', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('edits one line and restores identical bytes with undo and redo', () => {
    const store = create(),
      before = store.getSnapshot().files
    store.selectKey(0)
    store.setBinding(0, 0, '&kp CAPS')
    const after = store.getSnapshot().files
    expect(store.getSnapshot().dirty).toBe(true)
    const patch = Object.values(store.diff()).join('')
    expect(
      patch.split('\n').filter((line) => /^[-+]/.test(line) && !/^---|^\+\+\+/.test(line)),
    ).toHaveLength(2)
    expect(store.changedKeys(0)).toEqual(new Set([0]))
    expect(store.summary()[0]).toContain('key 0')
    expect(store.summary()[0]).toContain('→ &kp CAPS')
    store.selectKey(2)
    store.setActiveLayer(1)
    store.undo()
    expect(store.getSnapshot().files).toEqual(before)
    expect(store.getSnapshot().selectedKey).toBe(0)
    store.redo()
    expect(store.getSnapshot().files).toEqual(after)
    expect(store.getSnapshot().selectedKey).toBe(2)
    expect(store.getSnapshot().activeLayer).toBe(1)
  })
  it('coalesces repeated key edits within one second', () => {
    vi.useFakeTimers()
    const store = create(),
      before = binding(store)
    store.setBinding(0, 0, '&kp A')
    vi.advanceTimersByTime(500)
    store.setBinding(0, 0, '&kp B')
    store.undo()
    expect(binding(store)).toBe(before)
    store.redo()
    vi.advanceTimersByTime(1001)
    store.setBinding(0, 0, '&kp C')
    store.undo()
    expect(binding(store)).toBe('&kp B')
  })
  it('caps undo history at 200 snapshots', () => {
    const store = create()
    for (let index = 0; index < 205; index++) store.setBinding(0, index % 2, `&kp K${index}`)
    for (let index = 0; index < 200; index++) store.undo()
    expect(store.getSnapshot().canUndo).toBe(false)
    expect(store.getSnapshot().dirty).toBe(true)
  })
  it('memoizes derived data across selection changes', () => {
    const store = create(),
      before = store.getSnapshot()
    store.selectKey(1)
    store.setActiveLayer(1)
    expect(store.getSnapshot().model).toBe(before.model)
    expect(store.getSnapshot().layout).toBe(before.layout)
    expect(store.getSnapshot().issues).toBe(before.issues)
  })
  it('restores drafts and keeps mismatched drafts aside', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    }
    const events = new EventTarget()
    vi.stubGlobal('window', {
      localStorage: storage,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    })
    const first = create(),
      unsubscribe = first.subscribe(() => {})
    first.setBinding(0, 0, '&kp CAPS')
    unsubscribe()
    const restored = create()
    restored.subscribe(() => {})
    expect(binding(restored)).toBe('&kp CAPS')
    const changed = { ...files, 'extra.txt': 'changed baseline' }
    const stale = createEditorStore(changed, ADV360_PROFILE)
    stale.subscribe(() => {})
    expect(stale.getSnapshot().dirty).toBe(false)
    expect(stale.getSnapshot().staleDraft?.files).toEqual(first.getSnapshot().files)
  })
  it('registers the unload warning only while dirty and subscribed', () => {
    const add = vi.fn(),
      remove = vi.fn()
    vi.stubGlobal('window', {
      addEventListener: add,
      removeEventListener: remove,
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    })
    const store = create(),
      unsubscribe = store.subscribe(() => {})
    expect(add).not.toHaveBeenCalled()
    store.setBinding(0, 0, '&kp CAPS')
    expect(add).toHaveBeenCalledOnce()
    store.undo()
    expect(remove).toHaveBeenCalledOnce()
    store.redo()
    unsubscribe()
    expect(remove).toHaveBeenCalledTimes(2)
  })
  it('renders on the server without window', () => {
    vi.stubGlobal('window', undefined)
    expect(() =>
      renderToString(
        createElement(EditorProvider, {
          initialFiles: files,
          profile: ADV360_PROFILE,
          children: 'ok',
        }),
      ),
    ).not.toThrow()
  })
})
