import { useActiveProfile } from '../../lib/profile/active'
import { useEffect, useMemo, useState } from 'react'
import { Board, type BatchCommand, type SelectModifier } from '../board/Board'
import { ContextMenu, type ContextMenuItem } from '../board/ContextMenu'
import { LayerTabs } from '../board/LayerTabs'
import {
  AddLayerDialog,
  CopyLayerDialog,
  DeleteLayerDialog,
  RenameLayerDialog,
  SwapLayerDialog,
} from '../layers/LayerDialogs'
import type { LayerReference } from '../layers/LayerDialogs'
import { layerAccentOf } from '../board/bindings'
import { ChangesPill } from '../panels/ChangesPill'
import { ChangesSheet } from '../panels/ChangesSheet'
import { ProblemsPanel } from '../panels/ProblemsPanel'
import { BindingPicker } from '../picker/BindingPicker'
import { ThemePicker } from '../theme-picker/ThemePicker'
import { CommandPalette } from '../command-palette/CommandPalette'
import { buildCommands } from '../../lib/commands'
import { resolvePlatform } from '../../lib/keycodes/platform'
import { BehaviorsDrawer } from '../behaviors/BehaviorsDrawer'
import { useTheme } from '../../lib/theme/ThemeProvider'
import { useEditor } from '../../lib/editor-state'
import { defaultBranchName, useSync } from '../../lib/github-sync'
import { BuildPanel } from '../github/BuildPanel'
import { ExportDialog } from '../export/ExportDialog'
import { SyncHeader } from '../github/SyncHeader'
import { ProfileSelect } from '../github/ProfileSelect'
import { syncErrorText } from '../github/errorText'
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
import { SidePanel, focusStaysInside } from './SidePanel'
import { PickerPopover } from './PickerPopover'
import { layerOfIssue, layerTabsOf, legendContextOf, pickerInputsOf } from './editorModel'

/** localStorage key for the "Combos" toggle. */
const COMBOS_KEY = 'adv360.editor.showCombos'
/** Viewports narrower than this use the bottom sheet for the binding picker. */
const NARROW_QUERY = '(max-width: 639px)'

/** Which layer dialog is open. */
type LayerDialogState =
  | { kind: 'add' }
  | { kind: 'rename'; index: number }
  | { kind: 'delete'; index: number; references: LayerReference[] }
  | { kind: 'copy'; index: number }
  | { kind: 'swap-layers'; key: number }

/** The binding picker's target: which layer and key it edits, and where to draw it. */
interface PickerTarget {
  layer: number
  key: number
  /** Batch assign: every key the chosen binding is written to. Absent for a single key. */
  keys?: number[]
  anchor: { top: number; bottom: number; left: number } | null
}

/** Reads a boolean preference, falling back when storage is unavailable. */
/** Panels that can be docked beside the board. */
type PanelName = 'behaviors' | 'settings' | 'build'

/**
 * Class for a top-bar toggle: text with an underline when active, never a fill.
 * @param active - Whether the panel or option is showing.
 * @returns The Tailwind class string.
 */
function navButton(active: boolean): string {
  return `border-b-2 px-1 py-1 text-sm ${
    active
      ? 'border-accent-primary text-primary'
      : 'border-transparent text-secondary hover:text-primary'
  }`
}

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
  const profileContext = useActiveProfile()
  const { activeProfile } = profileContext
  const { settings, setPlatform, updateNavigation } = useSettings()
  const theme = useTheme()
  const narrow = useNarrow()
  const { model, layout, issues, activeLayer, selectedKey, profile, files } = editor
  const { scheme, arrowsAlwaysOn, wrap, custom } = settings.navigation

  const [picker, setPicker] = useState<PickerTarget | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  /** The one docked side panel, if any. */
  const [panel, setPanel] = useState<PanelName | null>(null)
  /** True while keyboard focus is inside the docked panel; board keys then pause. */
  const [dockFocused, setDockFocused] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const sync = useSync()
  /** The sync error the user dismissed, compared by identity. */
  const [dismissedError, setDismissedError] = useState<unknown>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [combosOn, setCombosOn] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [layerDialog, setLayerDialog] = useState<LayerDialogState | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  /** The key context menu's anchor point in viewport pixels, or null when closed. */
  const [keyMenu, setKeyMenu] = useState<{ x: number; y: number } | null>(null)
  /** Key chosen by "Swap with…"; the next key clicked on the board is the other half. */
  const [swapFrom, setSwapFrom] = useState<number | null>(null)
  /** Run a layer edit; on failure (e.g. a layer number written as an expression) show why. */
  const runLayerAction = (action: () => void, close = true) => {
    try {
      action()
      if (close) setLayerDialog(null)
      setNotice(null)
    } catch (error) {
      setLayerDialog(null)
      setNotice(error instanceof Error ? error.message : 'That layer change is not possible here.')
    }
  }

  const layerCount = model.layers.length
  const modalOpen =
    picker !== null ||
    paletteOpen ||
    themeOpen ||
    sheetOpen ||
    helpOpen ||
    layerDialog !== null ||
    keyMenu !== null
  const boardKeysOff = modalOpen || dockFocused

  /** Opens a panel, or closes the dock when that panel is already showing. */
  const togglePanel = (name: PanelName) => {
    setDockFocused(false)
    setPanel((current) => (current === name ? null : name))
  }
  const closePanel = () => {
    setDockFocused(false)
    setPanel(null)
  }

  // Read the stored preference after mount so server and first client render agree.
  useEffect(() => setCombosOn(readCombosPreference()), [])

  // A bounced sign-in returns with ?auth=not-allowed: show it once, then drop the parameter.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('auth') !== 'not-allowed') return
    setAuthNotice(syncErrorText({ code: 'not-allowed', message: '' }))
    url.searchParams.delete('auth')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  // A successful commit closes the review and shows the build dock.
  useEffect(() => {
    if (!sync.lastCommit) return
    setSheetOpen(false)
    setPanel('build')
  }, [sync.lastCommit])

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
      const text = formatPickerBinding(value)
      if (picker.keys) editor.assignToMany(picker.keys, text)
      else editor.setBinding(picker.layer, picker.key, text)
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
    enabled: !boardKeysOff,
    onSelect: (position) => {
      const key = layout.keys[position]
      if (key) editor.selectKey(key.index)
    },
    onAction: (action: Action) => {
      if (action === 'edit') {
        if (selectedKey !== null) openPicker(selectedKey)
      } else if (action === 'cancel') {
        if (swapFrom !== null) {
          setSwapFrom(null)
          setNotice(null)
        } else if (selectedKey !== null || editor.selectedKeys.size > 0) {
          editor.selectKey(null)
        }
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

  // ⌘K / Ctrl-K opens the command palette from anywhere.
  // Digits 1–9 pick a layer in the arrows and emacs schemes, but only when not typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      if (!/^[1-9]$/.test(event.key) || boardKeysOff) return
      if (scheme !== 'arrows' && scheme !== 'emacs') return
      if (!shouldHandleKeydown(event)) return
      const index = Number(event.key) - 1
      if (index >= layerCount) return
      event.preventDefault()
      editor.setActiveLayer(index)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, layerCount, boardKeysOff, scheme])

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
  // The parser stores behaviors without `&` (e.g. `tpf`); the picker works with `&tpf`.
  const rawBehavior = pickerBinding?.behavior ?? 'none'
  const pickerValue: BindingValue = {
    behavior: rawBehavior.startsWith('&') ? rawBehavior : `&${rawBehavior}`,
    params: [...(pickerBinding?.params ?? [])],
  }
  // ZMK hold-taps always take `HOLD TAP` params; the hold is a layer when the first wrapped
  // behavior is a layer behavior such as `&mo`.
  const holdTapInfo = model.behaviors
    .filter((behavior) => behavior.compatible === 'zmk,behavior-hold-tap')
    .map((behavior) => ({
      label: behavior.label ?? behavior.name,
      order: 'hold-tap' as const,
      holdKind: /^&?(mo|to|tog|sl)$/.test(behavior.bindings[0]?.text ?? '')
        ? ('layer' as const)
        : ('key' as const),
    }))
  const changeCount = summary.length

  const displayPlatform = resolvePlatform(settings.platform)
  const syncError = sync.error && sync.error !== dismissedError ? sync.error : null
  const errorText = syncError ? syncErrorText(syncError) : authNotice
  const dismissError = () => {
    setDismissedError(sync.error)
    setAuthNotice(null)
  }
  const retryFromError = () => {
    dismissError()
    void sync.reload()
  }

  // Batch edits. Copy, paste, cut and clear act on the selection; the dialogs ask for the rest.
  const selection = () => [...editor.selectedKeys].sort((first, second) => first - second)
  const singleKey = () => {
    const keys = selection()
    return keys.length === 1 ? keys[0] : null
  }
  const runBatch = (action: () => void) => {
    setNotice(null)
    try {
      action()
    } catch (error) {
      setNotice(messageOf(error))
    }
  }
  const copySelection = () => {
    const keys = selection()
    if (keys.length > 0) runBatch(() => editor.copyBindings(keys))
  }
  const pasteAtSelection = () => {
    const anchor = editor.selectedKey
    if (anchor === null || editor.clipboard.length === 0) return
    runBatch(() => {
      const { skipped } = editor.pasteBindings(anchor)
      if (skipped.length > 0)
        setNotice(
          `Skipped ${skipped.length} ${skipped.length === 1 ? 'key' : 'keys'} not on the board.`,
        )
    })
  }
  const cutSelection = () => {
    const keys = selection()
    if (keys.length > 0)
      runBatch(() => {
        editor.copyBindings(keys)
        editor.clearKeys(keys)
      })
  }
  const clearSelectedKeys = () => {
    const keys = selection()
    if (keys.length > 0) runBatch(() => editor.clearKeys(keys))
  }
  const swapSelected = () => {
    const keys = selection()
    if (keys.length === 2) runBatch(() => editor.swapKeys(keys[0], keys[1]))
  }
  const openSwapLayers = () => {
    const key = singleKey()
    if (key !== null) setLayerDialog({ kind: 'swap-layers', key })
  }
  const openCopyLayer = () => setLayerDialog({ kind: 'copy', index: activeLayer })
  const openAssign = () => {
    const keys = selection()
    const anchor = editor.selectedKey ?? keys[0]
    if (anchor === undefined) return
    const element = document.querySelector<HTMLElement>(`[data-key-index="${anchor}"]`)
    const box = element?.getBoundingClientRect()
    setNotice(null)
    setPicker({
      layer: activeLayer,
      key: anchor,
      keys,
      anchor: box ? { top: box.top, bottom: box.bottom, left: box.left } : null,
    })
  }
  const beginSwap = (key: number) => {
    setSwapFrom(key)
    setNotice(`Click a key to swap with key ${key}.`)
  }

  /** A key click on the board: the second half of a pending swap, or a selection change. */
  const selectFromBoard = (index: number, modifier?: SelectModifier) => {
    if (swapFrom !== null) {
      setSwapFrom(null)
      if (index === swapFrom) {
        setNotice(null)
        return
      }
      runBatch(() => {
        editor.swapKeys(swapFrom, index)
        editor.selectKey(index)
      })
      return
    }
    if (modifier === 'range') editor.selectRange(index)
    else if (modifier === 'toggle') editor.toggleKey(index)
    else editor.selectKey(index)
  }

  /** Right-click on a key: a key outside the selection becomes the selection first. */
  const openKeyMenu = (index: number, pointerX: number, pointerY: number) => {
    if (!editor.selectedKeys.has(index)) editor.selectKey(index)
    setKeyMenu({ x: pointerX, y: pointerY })
  }

  const runBoardCommand = (command: BatchCommand) => {
    if (command === 'edit.copy') copySelection()
    else if (command === 'edit.paste') pasteAtSelection()
    else if (command === 'edit.cut') cutSelection()
    else clearSelectedKeys()
  }

  // TODO(m4, ⌘K): add commands once src/lib/commands accepts them: Sign in with GitHub,
  // Sign out, Reload from GitHub, Commit & build (opens the review), Show build.
  const commands = buildCommands({
    layers: tabs.map(({ index, name }) => ({ index, name })),
    activeLayer,
    setActiveLayer: editor.setActiveLayer,
    addLayer: () => setLayerDialog({ kind: 'add' }),
    renameLayer: (index) => setLayerDialog({ kind: 'rename', index }),
    moveLayer: (index, to) => runLayerAction(() => editor.moveLayer(index, to)),
    deleteLayer: (index) =>
      runLayerAction(
        () =>
          setLayerDialog({
            kind: 'delete',
            index,
            references: editor.layerReferences(index),
          }),
        false,
      ),
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    undo: editor.undo,
    redo: editor.redo,
    dirty: editor.dirty,
    reviewChanges: () => setSheetOpen(true),
    discardChanges: () => editor.reset(),
    combosShown: combosOn,
    toggleCombos,
    openBehaviors: () => setPanel('behaviors'),
    openThemePicker: () => setThemeOpen(true),
    openExport: () => setExportOpen(true),
    themeMode: theme.preference.mode,
    setThemeMode: (mode) => theme.setPreference({ ...theme.preference, mode }),
    openSettings: () => setPanel('settings'),
    openHelp: () => setHelpOpen(true),
    scheme,
    setScheme: (next) => updateNavigation({ scheme: next }),
    arrowsAlwaysOn,
    setArrowsAlwaysOn: (on) => updateNavigation({ arrowsAlwaysOn: on }),
    wrap,
    setWrap: (on) => updateNavigation({ wrap: on }),
    platform: settings.platform,
    setPlatform,
    displayPlatform,
    batch: {
      selectedCount: editor.selectedKeys.size,
      canPaste: editor.clipboard.length > 0,
      copy: copySelection,
      paste: pasteAtSelection,
      cut: cutSelection,
      clear: clearSelectedKeys,
      swap: swapSelected,
      swapAcrossLayers: openSwapLayers,
      assign: openAssign,
      copyLayer: openCopyLayer,
    },
  })

  const shortcutOf = (letter: string) =>
    displayPlatform === 'mac' ? `⌘${letter}` : `Ctrl+${letter}`
  const single = singleKey()
  const keyMenuItems: ContextMenuItem[] = [
    {
      key: 'copy',
      label: 'Copy',
      shortcut: shortcutOf('C'),
      disabled: editor.selectedKeys.size === 0,
      run: copySelection,
    },
    {
      key: 'paste',
      label: 'Paste',
      shortcut: shortcutOf('V'),
      disabled: editor.clipboard.length === 0 || editor.selectedKey === null,
      run: pasteAtSelection,
    },
    {
      key: 'cut',
      label: 'Cut',
      shortcut: shortcutOf('X'),
      disabled: editor.selectedKeys.size === 0,
      run: cutSelection,
    },
    {
      key: 'clear',
      label: 'Clear',
      shortcut: displayPlatform === 'mac' ? '⌫' : 'Del',
      disabled: editor.selectedKeys.size === 0,
      run: clearSelectedKeys,
    },
    {
      key: 'swap',
      label: 'Swap with…',
      disabled: single === null,
      run: () => {
        if (single !== null) beginSwap(single)
      },
    },
    {
      key: 'swap-layers',
      label: 'Swap with layer…',
      disabled: single === null,
      run: openSwapLayers,
    },
    {
      key: 'assign',
      label: 'Assign to selected…',
      disabled: editor.selectedKeys.size === 0,
      run: openAssign,
    },
  ]

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden bg-canvas text-primary">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-subtle px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">adv360</span>
          {profileContext.profiles.length > 1 ? (
            <ProfileSelect
              profiles={profileContext.profiles}
              activeProfile={activeProfile}
              setActiveProfile={profileContext.setActiveProfile}
              status={sync.phase === 'loading' ? `Loading ${activeProfile.name}…` : null}
            />
          ) : (
            <span className="text-sm text-secondary">{profile.name}</span>
          )}
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
            aria-label="Open command palette"
            onClick={() => setPaletteOpen(true)}
            className="rounded-none border border-subtle px-2 py-1 font-mono text-xs text-muted hover:bg-hover"
          >
            {displayPlatform === 'mac' ? '⌘K' : 'Ctrl K'}
          </button>
          {sync.lastCommit || sync.build ? (
            <button
              type="button"
              aria-pressed={panel === 'build'}
              onClick={() => togglePanel('build')}
              className={navButton(panel === 'build')}
            >
              Build
            </button>
          ) : null}
          <SyncHeader
            phase={sync.phase}
            user={sync.user}
            source={sync.source}
            errorText={errorText}
            onRetry={syncError ? retryFromError : null}
            remoteSha={sync.remoteSha}
            onApplyRemote={sync.applyRemote}
            onSignIn={sync.signIn}
            onSignOut={sync.signOut}
            onReload={sync.reload}
            onDismiss={dismissError}
          />
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="inline-flex items-center gap-2 px-2.5 py-1 text-sm hover:bg-hover"
          >
            {theme.active.name}
          </button>
          <button
            type="button"
            aria-pressed={panel === 'behaviors'}
            onClick={() => togglePanel('behaviors')}
            className={navButton(panel === 'behaviors')}
          >
            Behaviors
          </button>
          <button
            type="button"
            aria-pressed={combosOn}
            onClick={toggleCombos}
            className={`px-1 py-1 text-sm hover:text-primary ${combosOn ? 'text-primary' : 'text-muted'}`}
          >
            Combos
          </button>
          <button
            type="button"
            aria-pressed={panel === 'settings'}
            onClick={() => togglePanel('settings')}
            className={navButton(panel === 'settings')}
          >
            Settings
          </button>
        </div>
      </header>

      <div className="shell-layer relative flex min-h-0 max-md:[&:has([data-problems-collapsed])_main]:pt-12">
        <ProblemsPanel issues={issues} onJump={jump} />
        <div className="shell-layer relative min-w-0 flex-1">
          <div className="absolute inset-0 overflow-auto">
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
                <LayerTabs
                  layers={tabs}
                  active={activeLayer}
                  onChange={editor.setActiveLayer}
                  onAdd={() => setLayerDialog({ kind: 'add' })}
                  onRename={(index) => setLayerDialog({ kind: 'rename', index })}
                  onMove={(index, to) => runLayerAction(() => editor.moveLayer(index, to))}
                  onDelete={(index) =>
                    runLayerAction(
                      () =>
                        setLayerDialog({
                          kind: 'delete',
                          index,
                          references: editor.layerReferences(index),
                        }),
                      false,
                    )
                  }
                  onCopy={(index) => setLayerDialog({ kind: 'copy', index })}
                />
              </div>

              <section aria-label="Keyboard" className="w-full">
                <Board
                  layout={layout}
                  bindings={bindings}
                  legendContext={legend}
                  selectedKey={selectedKey}
                  selectedKeys={editor.selectedKeys}
                  changedKeys={changed}
                  combos={model.combos}
                  layerAccent={layerAccentOf(activeLayer)}
                  layerIndex={activeLayer}
                  showCombos={combosOn}
                  onSelectKey={selectFromBoard}
                  onActivateKey={openPicker}
                  onKeyContextMenu={openKeyMenu}
                  onBatchCommand={runBoardCommand}
                />
              </section>

              {/* Always mounted: screen readers announce changes to a live region that exists. */}
              <p role="status" className="text-sm text-secondary">
                {notice}
              </p>
            </main>
          </div>
          <ChangesPill count={changeCount} onOpen={() => setSheetOpen(true)} />
        </div>

        <div
          className="contents"
          onFocus={() => setDockFocused(true)}
          onBlur={(event) => setDockFocused(focusStaysInside(event))}
        >
          <BehaviorsDrawer open={panel === 'behaviors'} onClose={closePanel} />
          {panel === 'build' ? (
            <SidePanel title="Build" onClose={closePanel}>
              <BuildPanel
                commit={sync.lastCommit}
                build={sync.build}
                buildTimedOut={sync.buildTimedOut}
                onRepoll={sync.repollBuild}
              />
            </SidePanel>
          ) : null}
          {panel === 'settings' ? (
            <SettingsDialog
              platform={settings.platform}
              onPlatform={setPlatform}
              onClose={closePanel}
            />
          ) : null}
        </div>

        {sheetOpen ? (
          <ChangesSheet
            diff={diff}
            summary={summary}
            onClose={() => setSheetOpen(false)}
            onDiscard={() => {
              editor.reset()
              setSheetOpen(false)
            }}
            commit={{
              signedIn: sync.user !== null,
              committing: sync.phase === 'committing',
              defaultBranch: defaultBranchName(new Date()),
              protectedBranch: activeProfile.branch,
              onSignIn: sync.signIn,
              onCommit: ({ message, branch, allowDefaultBranch }) => {
                const changed = Object.keys(editor.diff()).filter((path) => path in editor.files)
                void sync.commit({
                  message,
                  branch,
                  allowDefaultBranch,
                  changedFiles: Object.fromEntries(
                    changed.map((path) => [path, editor.files[path]]),
                  ),
                })
              },
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
              holdTapInfo={holdTapInfo}
              userKeycodes={model.userKeycodes}
              preferredNames={preferredNames}
              platform={settings.platform}
              onChange={commitPicker}
              onClose={() => setPicker(null)}
            />
          </PickerPopover>
        ) : null}

        <CommandPalette
          open={paletteOpen}
          commands={commands}
          onClose={() => setPaletteOpen(false)}
        />

        <ThemePicker open={themeOpen} onClose={() => setThemeOpen(false)} />

        {layerDialog?.kind === 'add' ? (
          <AddLayerDialog
            layers={tabs.map(({ index, name }) => ({ index, name }))}
            onCreate={(input) => runLayerAction(() => editor.addLayer(input))}
            onClose={() => setLayerDialog(null)}
          />
        ) : null}
        {layerDialog?.kind === 'rename' ? (
          <RenameLayerDialog
            name={tabs[layerDialog.index]?.name ?? ''}
            onRename={(label) => runLayerAction(() => editor.renameLayer(layerDialog.index, label))}
            onClose={() => setLayerDialog(null)}
          />
        ) : null}
        {layerDialog?.kind === 'delete' ? (
          <DeleteLayerDialog
            name={tabs[layerDialog.index]?.name ?? ''}
            references={layerDialog.references}
            layerNames={tabs.map((tab) => tab.name)}
            onDelete={() => runLayerAction(() => editor.removeLayer(layerDialog.index))}
            onClose={() => setLayerDialog(null)}
          />
        ) : null}

        {keyMenu ? (
          <ContextMenu
            label="Key actions"
            x={keyMenu.x}
            y={keyMenu.y}
            items={keyMenuItems}
            onClose={() => setKeyMenu(null)}
          />
        ) : null}
        {layerDialog?.kind === 'copy' ? (
          <CopyLayerDialog
            source={{ index: layerDialog.index, name: tabs[layerDialog.index]?.name ?? '' }}
            layers={tabs.map(({ index, name }) => ({ index, name }))}
            onCopy={(target) => runLayerAction(() => editor.copyLayer(layerDialog.index, target))}
            onClose={() => setLayerDialog(null)}
          />
        ) : null}
        {layerDialog?.kind === 'swap-layers' ? (
          <SwapLayerDialog
            keyIndex={layerDialog.key}
            source={{ index: activeLayer, name: tabs[activeLayer]?.name ?? '' }}
            targets={tabs
              .filter(({ index }) => index !== activeLayer)
              .map(({ index, name }) => ({ index, name }))}
            onSwap={(target) =>
              runLayerAction(() =>
                editor.swapKeysAcrossLayers(layerDialog.key, activeLayer, target),
              )
            }
            onClose={() => setLayerDialog(null)}
          />
        ) : null}

        {exportOpen ? (
          <ExportDialog
            model={model}
            layout={layout}
            tokens={theme.tokens}
            layers={tabs.map(({ index, name }) => ({ index, name }))}
            onClose={() => setExportOpen(false)}
          />
        ) : null}
        {helpOpen ? (
          <CheatSheet
            scheme={scheme}
            custom={custom}
            arrowsAlwaysOn={arrowsAlwaysOn}
            onClose={() => setHelpOpen(false)}
          />
        ) : null}
      </div>
    </div>
  )
}
