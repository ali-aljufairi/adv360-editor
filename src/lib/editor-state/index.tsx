import { createContext, useContext, useRef, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createEditorForProfile, diff as fileDiff, validate } from '../zmk'
import type {
  BindingInput,
  ComboInput,
  FileMap,
  HoldTapInput,
  Issue,
  MacroInput,
  Model,
} from '../zmk'
import type { KeyboardProfile } from '../profile'
import type { PhysicalLayout } from '../layout'
import { describeBinding } from '../legend/describe'
import { sha256 } from './hash'

export interface StaleDraft {
  baselineHash: string
  files: FileMap
}
export interface EditorState {
  profile: KeyboardProfile
  files: FileMap
  model: Model
  layout: PhysicalLayout
  issues: Issue[]
  activeLayer: number
  selectedKey: number | null
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
  staleDraft: StaleDraft | null
}
export interface EditorActions {
  selectKey(index: number | null): void
  setActiveLayer(index: number): void
  setBinding(layer: number, key: number, binding: string | BindingInput): void
  updateMacro(name: string, changes: Partial<MacroInput>): void
  updateHoldTap(name: string, changes: HoldTapInput): void
  addCombo(input: ComboInput): void
  updateCombo(name: string, changes: Partial<ComboInput>): void
  removeCombo(name: string): void
  undo(): void
  redo(): void
  diff(): Record<string, string>
  reset(): void
  load(files: FileMap, profile: KeyboardProfile): void
  changedKeys(layer: number): Set<number>
  summary(): string[]
}
export interface EditorStore extends EditorActions {
  getSnapshot(): EditorState
  subscribe(listener: () => void): () => void
}

type Snapshot = { files: FileMap; activeLayer: number; selectedKey: number | null }
const equal = (first: FileMap, second: FileMap) => {
  const keys = Object.keys(first)
  return (
    keys.length === Object.keys(second).length && keys.every((key) => first[key] === second[key])
  )
}
const hashFiles = (files: FileMap) =>
  sha256(
    JSON.stringify(
      Object.keys(files)
        .sort()
        .map((key) => [key, files[key]]),
    ),
  )
const pretty = (name: string) =>
  name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

/** Create a React-independent store. Browser effects start on the first subscription. */
export function createEditorStore(
  initialFiles: FileMap,
  initialProfile: KeyboardProfile,
): EditorStore {
  let baseline = { ...initialFiles },
    profile = initialProfile
  let current: Snapshot = { files: { ...baseline }, activeLayer: 0, selectedKey: null }
  let baselineHash = hashFiles(baseline)
  let baselineModel = createEditorForProfile(profile, baseline).model
  let past: Snapshot[] = [],
    future: Snapshot[] = []
  let lastEdit: { key: string; time: number } | null = null
  let staleDraft: StaleDraft | null = null
  let started = false,
    warning = false,
    initialized = false
  const listeners = new Set<() => void>()
  const derive = (files: FileMap) => {
    const editor = createEditorForProfile(profile, files)
    const layout = editor.layout!
    const model = editor.model
    return { model, layout, issues: validate(model, { physicalLayout: layout.keys }) }
  }
  let derived = derive(current.files)
  let state: EditorState
  const refresh = () => {
    state = {
      profile,
      ...current,
      ...derived,
      dirty: !equal(current.files, baseline),
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      staleDraft,
    }
  }
  refresh()
  const keyPrefix = () => `adv360-editor:draft:${encodeURIComponent(profile.id)}`
  const unload = (event: BeforeUnloadEvent) => {
    event.preventDefault()
    event.returnValue = ''
  }
  const effects = () => {
    if (!started || typeof window === 'undefined') return
    if (state.dirty !== warning) {
      if (state.dirty) window.addEventListener('beforeunload', unload)
      else window.removeEventListener('beforeunload', unload)
      warning = state.dirty
    }
    try {
      const storage = window.localStorage
      const key = `${keyPrefix()}:${baselineHash}`
      if (state.dirty) {
        storage.setItem(key, JSON.stringify({ baselineHash, files: current.files }))
        storage.setItem(`${keyPrefix()}:latest`, baselineHash)
      } else {
        storage.removeItem(key)
        if (storage.getItem(`${keyPrefix()}:latest`) === baselineHash)
          storage.removeItem(`${keyPrefix()}:latest`)
      }
    } catch {
      /* Storage may be unavailable. */
    }
  }
  const emit = (filesChanged = false) => {
    if (filesChanged) derived = derive(current.files)
    refresh()
    effects()
    listeners.forEach((listener) => listener())
  }
  const restore = () => {
    staleDraft = null
    if (typeof window === 'undefined') return
    try {
      const storage = window.localStorage
      const prefix = keyPrefix()
      const latest = storage.getItem(`${prefix}:latest`)
      const stored = storage.getItem(`${prefix}:${baselineHash}`)
      const raw = stored ?? (latest ? storage.getItem(`${prefix}:${latest}`) : null)
      if (!raw) return
      const draft: unknown = JSON.parse(raw)
      if (!draft || typeof draft !== 'object') return
      const candidate = draft as { baselineHash?: unknown; files?: unknown }
      if (
        typeof candidate.baselineHash !== 'string' ||
        !candidate.files ||
        typeof candidate.files !== 'object' ||
        Array.isArray(candidate.files) ||
        !Object.values(candidate.files).every((value) => typeof value === 'string')
      )
        return
      const files = candidate.files as FileMap
      if (candidate.baselineHash !== baselineHash)
        staleDraft = { baselineHash: candidate.baselineHash, files }
      else if (!equal(files, baseline)) {
        const restored = derive(files) // Reject invalid drafts without changing the session.
        past = [current]
        current = { ...current, files: { ...files } }
        derived = restored
      }
    } catch {
      /* Ignore corrupt or inaccessible drafts. */
    }
  }
  const edit = (
    operation: (editor: ReturnType<typeof createEditorForProfile>) => void,
    key?: string,
  ) => {
    const editor = createEditorForProfile(profile, current.files)
    operation(editor)
    const files = editor.serialize()
    if (equal(files, current.files)) return
    const now = Date.now()
    if (!key || !lastEdit || lastEdit.key !== key || now - lastEdit.time > 1000 || future.length) {
      past.push(current)
      if (past.length > 200) past.shift()
    }
    lastEdit = key ? { key, time: now } : null
    future = []
    current = { ...current, files }
    emit(true)
  }
  const actions: EditorStore = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      if (!started) {
        started = true
        if (!initialized) {
          if (equal(current.files, baseline)) restore()
          initialized = true
        }
        emit()
      }
      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          if (warning && typeof window !== 'undefined')
            window.removeEventListener('beforeunload', unload)
          warning = false
          started = false
        }
      }
    },
    selectKey: (selectedKey) => {
      current = { ...current, selectedKey }
      lastEdit = null
      emit()
    },
    setActiveLayer: (activeLayer) => {
      current = { ...current, activeLayer }
      lastEdit = null
      emit()
    },
    setBinding: (layer, key, binding) =>
      edit((editor) => editor.setBinding(layer, key, binding), `${layer}:${key}`),
    updateMacro: (name, changes) => edit((editor) => editor.updateMacro(name, changes)),
    updateHoldTap: (name, changes) => edit((editor) => editor.updateHoldTap(name, changes)),
    addCombo: (input) => edit((editor) => editor.addCombo(input)),
    updateCombo: (name, changes) => edit((editor) => editor.updateCombo(name, changes)),
    removeCombo: (name) => edit((editor) => editor.removeCombo(name)),
    undo: () => {
      const previous = past.pop()
      if (!previous) return
      future.push(current)
      current = previous
      lastEdit = null
      emit(true)
    },
    redo: () => {
      const next = future.pop()
      if (!next) return
      past.push(current)
      current = next
      lastEdit = null
      emit(true)
    },
    diff: () => fileDiff(baseline, current.files),
    reset: () => {
      current = { ...current, files: { ...baseline } }
      past = []
      future = []
      lastEdit = null
      emit(true)
    },
    load: (files, nextProfile) => {
      baseline = { ...files }
      profile = nextProfile
      baselineHash = hashFiles(baseline)
      baselineModel = createEditorForProfile(profile, baseline).model
      current = { files: { ...baseline }, activeLayer: 0, selectedKey: null }
      past = []
      future = []
      lastEdit = null
      staleDraft = null
      if (started) restore()
      emit(true)
    },
    changedKeys: (layer) => {
      const before = baselineModel.layers[layer]?.bindings ?? []
      const after = derived.model.layers[layer]?.bindings ?? []
      return new Set(
        Array.from({ length: Math.max(before.length, after.length) }, (_, index) => index).filter(
          (index) => before[index]?.text !== after[index]?.text,
        ),
      )
    },
    summary: () => {
      const lines: string[] = []
      const layerNames = derived.model.layers.map((layer) =>
        pretty(layer.displayName ?? layer.name),
      )
      for (
        let layer = 0;
        layer < Math.max(baselineModel.layers.length, derived.model.layers.length);
        layer++
      ) {
        for (const key of actions.changedKeys(layer)) {
          const before = baselineModel.layers[layer]?.bindings[key]
          const after = derived.model.layers[layer]?.bindings[key]
          const label = before ? describeBinding(before, { layerNames }).primary : ''
          lines.push(
            `${layerNames[layer] ?? pretty(baselineModel.layers[layer]?.name ?? `Layer ${layer}`)} · key ${key}${label ? ` (${label})` : ''}: ${before?.text ?? '∅'} → ${after?.text ?? '∅'}`,
          )
        }
      }
      if (!lines.length) {
        for (const file of Object.keys(fileDiff(baseline, current.files))) {
          lines.push(`Changed ${file}`)
        }
      }
      return lines
    },
  }
  return actions
}

const EditorContext = createContext<(EditorState & EditorActions) | null>(null)
/** Provide the store to React consumers. */
export function EditorProvider({
  initialFiles,
  profile,
  children,
}: {
  initialFiles: FileMap
  profile: KeyboardProfile
  children: ReactNode
}) {
  const storeRef = useRef<EditorStore | null>(null)
  if (!storeRef.current) storeRef.current = createEditorStore(initialFiles, profile)
  const store = storeRef.current
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return <EditorContext.Provider value={{ ...state, ...store }}>{children}</EditorContext.Provider>
}
/** Read editor state and actions from the nearest provider. */
export function useEditor(): EditorState & EditorActions {
  const context = useContext(EditorContext)
  if (!context) throw new Error('useEditor must be used inside EditorProvider')
  return context
}
/** Load the bundled Adv360 fixture as profile-relative configuration files. */
export function loadFixtureFiles(): FileMap {
  const modules = import.meta.glob('../../../fixtures/adv360/**/*.{keymap,dtsi,json}', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>
  return Object.fromEntries(
    Object.entries(modules).map(([path, contents]) => [
      `config/${path.split('/fixtures/adv360/')[1]}`,
      contents,
    ]),
  )
}
