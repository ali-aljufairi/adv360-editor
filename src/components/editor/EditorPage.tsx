import { useEffect, useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { LayerTabs } from '../board/LayerTabs'
import { layerAccentOf } from '../board/bindings'
import { ChangesPill } from '../panels/ChangesPill'
import { ChangesSheet } from '../panels/ChangesSheet'
import { ProblemsPanel } from '../panels/ProblemsPanel'
import { BindingPicker } from '../picker/BindingPicker'
import { ThemePicker } from '../theme-picker/ThemePicker'
import { useTheme } from '../../lib/theme/ThemeProvider'
import { useEditor } from '../../lib/editor-state'
import { useSettings } from '../../lib/settings/context'
import { useBoardNavigation } from '../../lib/settings/useBoardNavigation'
import type { Action } from '../../lib/navigation/actions'
import { shouldHandleKeydown } from '../../lib/navigation/keys'
import {
  collectPreferredNames,
  formatBinding as formatPickerBinding,
  type BindingValue,
} from '../../lib/keycodes/binding'
import type { Issue } from '../../lib/zmk/types'
import { CheatSheet, SettingsDialog } from './Dialog'
import { PickerPopover } from './PickerPopover'
import { layerOfIssue, layerTabsOf, legendContextOf, pickerInputsOf } from './editorModel'

/** localStorage key for the "Combos" toggle. */
const COMBOS_KEY = 'adv360.editor.showCombos'
/** Viewports narrower than this use the bottom sheet for the binding picker. */
const NARROW_QUERY = '(max-width: 639px)'

/** The binding picker's target: which layer and key it edits, and where to draw it. */
interface PickerTarget {
  layer: number
  key: number
  anchor: { top: number; bottom: number; left: number } | null
}

/** Reads a boolean preference, falling back when storage is unavailable. */
function readCombosPreference(): boolean {
  try {
    return window.localStorage.getItem(COMBOS_KEY) !== 'false'
  } catch {
    return true
  }
}

/** Reads whether the viewport is narrow, and follows resizes. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY)
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return narrow
}

/** Message from a thrown value, for the notice line. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

/**
 * The editor page: the board, layer tabs, binding picker, problems, pending changes, theme and
 * settings. State and edits come from the editor store; this component wires them together.
 * Must render inside EditorProvider and SettingsProvider.
 * @returns The editor page.
 */
export function EditorPage() {
  const editor = useEditor()
  const { settings, setPlatform } = useSettings()
  const theme = useTheme()
  const narrow = useNarrow()
  const { model, layout, issues, activeLayer, selectedKey, profile, files } = editor
  const { scheme, arrowsAlwaysOn, custom } = settings.navigation

  const [picker, setPicker] = useState<PickerTarget | null>(null)
  const [themeOpen, setThemeOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [combosOn, setCombosOn] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const layerCount = model.layers.length
  const modalOpen = picker !== null || themeOpen || sheetOpen || settingsOpen || helpOpen

  // Read the stored preference after mount so server and first client render agree.
  useEffect(() => setCombosOn(readCombosPreference()), [])

  const tabs = useMemo(() => layerTabsOf(model, issues), [model, issues])
  const legend = useMemo(() => legendContextOf(model), [model])
  const pickerInputs = useMemo(() => pickerInputsOf(model), [model])
  const preferredNames = useMemo(
    () => collectPreferredNames(model.layers.flatMap((layer) => layer.bindings)),
    [model],
  )
  const bindings = model.layers[activeLayer]?.bindings ?? []
  const changed = useMemo(() => editor.changedKeys(activeLayer), [editor, activeLayer])
  const summary = useMemo(() => editor.summary(), [editor, files])
  const diff = useMemo(() => (sheetOpen ? editor.diff() : {}), [editor, sheetOpen, files])

  const openPicker = (key: number) => {
    const binding = model.layers[activeLayer]?.bindings[key]
    if (!binding) return
    if (!binding.editable) {
      setNotice(binding.reason ?? 'This binding is opaque and cannot be edited here.')
      return
    }
    const element = document.querySelector<HTMLElement>(`[data-key-index="${key}"]`)
    const box = element?.getBoundingClientRect()
    setNotice(null)
    setPicker({
      layer: activeLayer,
      key,
      anchor: box ? { top: box.top, bottom: box.bottom, left: box.left } : null,
    })
  }

  const commitPicker = (value: BindingValue) => {
    if (!picker) return
    try {
      editor.setBinding(picker.layer, picker.key, formatPickerBinding(value))
      setNotice(null)
    } catch (error) {
      setNotice(messageOf(error))
    }
    setPicker(null)
  }

  const jump = (issue: Issue) => {
    const layer = layerOfIssue(model, issue)
    if (layer >= 0) editor.setActiveLayer(layer)
    if (issue.key !== undefined) editor.selectKey(issue.key)
  }

  // Keyboard navigation. Movement actions go through selectKey; the rest are handled here.
  const selectedPosition =
    selectedKey === null ? -1 : layout.keys.findIndex((key) => key.index === selectedKey)
  useBoardNavigation({
    keys: layout.keys,
    selected: selectedPosition,
    enabled: !modalOpen,
    onSelect: (position) => {
      const key = layout.keys[position]
      if (key) editor.selectKey(key.index)
    },
    onAction: (action: Action) => {
      if (action === 'edit') {
        if (selectedKey !== null) openPicker(selectedKey)
      } else if (action === 'cancel') {
        if (selectedKey !== null) editor.selectKey(null)
      } else if (action === 'nextLayer' || action === 'prevLayer') {
        if (layerCount === 0) return
        const step = action === 'nextLayer' ? 1 : -1
        editor.setActiveLayer((activeLayer + step + layerCount) % layerCount)
      } else if (action === 'undo') {
        editor.undo()
      } else if (action === 'redo') {
        editor.redo()
      } else if (action === 'help') {
        setHelpOpen(true)
      }
    },
  })

  // ⌘K / Ctrl-K opens the theme picker from anywhere.
  // Digits 1–4 pick a layer in the arrows and emacs schemes, but only when not typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setThemeOpen(true)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      if (!/^[1-4]$/.test(event.key) || modalOpen) return
      if (scheme !== 'arrows' && scheme !== 'emacs') return
      if (!shouldHandleKeydown(event)) return
      const index = Number(event.key) - 1
      if (index >= layerCount) return
      event.preventDefault()
      editor.setActiveLayer(index)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, layerCount, modalOpen, scheme])

  const toggleCombos = () => {
    const next = !combosOn
    setCombosOn(next)
    try {
      window.localStorage.setItem(COMBOS_KEY, String(next))
    } catch {
      /* Storage is blocked; the toggle still works for this visit. */
    }
  }

  const runDraftAction = (action: () => void) => {
    try {
      action()
      setNotice(null)
    } catch (error) {
      setNotice(`Could not update the draft: ${messageOf(error)}`)
    }
  }

  const pickerBinding = picker ? model.layers[picker.layer]?.bindings[picker.key] : undefined
  const pickerValue: BindingValue = {
    behavior: pickerBinding?.behavior ?? '&none',
    params: [...(pickerBinding?.params ?? [])],
  }
  const changeCount = summary.length

  return (
    <div className="min-h-dvh bg-canvas text-primary">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-subtle px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">adv360</span>
          <span className="text-sm text-secondary">{profile.name}</span>
          <span
            aria-label="Branch V3.0"
            className="rounded-full border border-subtle px-2 text-xs text-muted"
          >
            V3.0
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-subtle px-2.5 py-1 text-sm hover:bg-hover"
          >
            {theme.active.name}
            <kbd className="rounded border border-subtle px-1 text-xs text-muted">⌘K</kbd>
          </button>
          <button
            type="button"
            aria-pressed={combosOn}
            onClick={toggleCombos}
            className={`rounded-md border border-subtle px-2.5 py-1 text-sm hover:bg-hover ${combosOn ? 'bg-hover' : ''}`}
          >
            Combos
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-subtle px-2.5 py-1 text-sm hover:bg-hover"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-5 pb-28 sm:px-6">
        {editor.staleDraft ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-raised p-3 text-sm"
          >
            <p className="mr-auto text-secondary">
              A saved draft from an earlier version of this keymap was found.
            </p>
            <button
              type="button"
              onClick={() => runDraftAction(editor.restoreDraft)}
              className="rounded-md border border-subtle px-2.5 py-1 hover:bg-hover"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => runDraftAction(editor.discardDraft)}
              className="rounded-md px-2.5 py-1 text-secondary hover:bg-hover"
            >
              Discard
            </button>
          </div>
        ) : null}

        <div className="flex justify-center">
          <LayerTabs layers={tabs} active={activeLayer} onChange={editor.setActiveLayer} />
        </div>

        <section aria-label="Keyboard" className="w-full">
          <Board
            layout={layout}
            bindings={bindings}
            legendContext={legend}
            selectedKey={selectedKey}
            changedKeys={changed}
            combos={model.combos}
            layerAccent={layerAccentOf(activeLayer)}
            layerIndex={activeLayer}
            showCombos={combosOn}
            onSelectKey={editor.selectKey}
            onActivateKey={openPicker}
          />
        </section>

        {notice ? (
          <p role="status" className="text-sm text-secondary">
            {notice}
          </p>
        ) : null}

        <div className="w-full max-w-sm">
          <ProblemsPanel issues={issues} onJump={jump} />
        </div>
      </main>

      <ChangesPill count={changeCount} onOpen={() => setSheetOpen(true)} />

      {sheetOpen ? (
        <ChangesSheet
          diff={diff}
          summary={summary}
          onClose={() => setSheetOpen(false)}
          onDiscard={() => {
            editor.reset()
            setSheetOpen(false)
          }}
        />
      ) : null}

      {picker ? (
        <PickerPopover
          key={`${picker.layer}:${picker.key}`}
          anchor={picker.anchor}
          sheet={narrow}
          onClose={() => setPicker(null)}
        >
          <BindingPicker
            value={pickerValue}
            layers={pickerInputs.layers}
            macros={pickerInputs.macros}
            holdTaps={pickerInputs.holdTaps}
            userKeycodes={model.userKeycodes}
            preferredNames={preferredNames}
            platform={settings.platform}
            onChange={commitPicker}
            onClose={() => setPicker(null)}
          />
        </PickerPopover>
      ) : null}

      <ThemePicker open={themeOpen} onClose={() => setThemeOpen(false)} />

      {helpOpen ? (
        <CheatSheet
          scheme={scheme}
          custom={custom}
          arrowsAlwaysOn={arrowsAlwaysOn}
          onClose={() => setHelpOpen(false)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsDialog
          platform={settings.platform}
          onPlatform={setPlatform}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}
