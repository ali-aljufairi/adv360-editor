import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  GROUPS,
  resolveKeyCode,
  type GroupId,
  type PreferredNames,
  type UserKeycode,
} from '../../lib/keycodes/catalog'
import {
  BEHAVIOR_TABS,
  buildBinding,
  DEFAULT_HOLD_TAPS,
  draftFromBinding,
  formatBinding,
  holdKindOf,
  holdTapSpecs,
  kindOfBinding,
  LAYER_MODES,
  layerBinding,
  layerModeOf,
  MOD_CHIPS,
  parseBindingText,
  type BehaviorTab,
  type BindingValue,
  type Choice,
  type Draft,
  type HoldKind,
  type HoldTapEntry,
  type HoldTapSpec,
  type LayerMode,
  type ModChip,
  type ModId,
} from '../../lib/keycodes/binding'
import { rankEntries } from '../../lib/keycodes/fuzzy'
import {
  resolvePlatform,
  type PlatformSetting,
  type ResolvedPlatform,
} from '../../lib/keycodes/platform'
import { eventToToken } from '../../lib/navigation/keys'
import type { SchemeName } from '../../lib/navigation/schemes'
import {
  buildHoldLayerItems,
  buildItems,
  commonIds,
  describeBinding,
  keycapParts,
  loadRecent,
  pushRecent,
  type PickerHoldTap,
  type PickerItem,
  type PickerLayer,
  type PickerMacro,
} from './items'
import {
  focusPickerSearch,
  matchSpans,
  pickerKeyAction,
  preservePickerSearchFocus,
} from './listKeys'
import { useOptionalSettings } from './useOptionalSettings'
import './picker.css'
import './behavior.css'

/** Props for the binding picker. */
export interface BindingPickerProps {
  /** The binding being edited. */
  value: BindingValue
  layers: PickerLayer[]
  macros: PickerMacro[]
  holdTaps: PickerHoldTap[]
  /**
   * Parameter order and hold kind for hold-taps, by label. A `tpf` with `order: 'hold-tap'` is
   * written `&tpf HOLD TAP`. Hold-taps not listed here default to hold-tap order and a key hold.
   */
  holdTapInfo?: readonly HoldTapInfo[]
  /** First steps of each macro, by name without `&`. Shown beside the macro in its tab. */
  macroPreview?: Readonly<Record<string, string>>
  /** Called once with the finished binding. */
  onChange: (binding: BindingValue) => void
  /** Called when the picker should close, after a commit or on Escape. */
  onClose: () => void
  /** Platform for shortcuts. Defaults to the settings value, or `auto` without settings. */
  platform?: PlatformSetting
  /** Navigation scheme for the results list. Defaults to the settings value, or `arrows`. */
  scheme?: SchemeName
  /** Usage id to the spelling the user's keymap uses; see `collectPreferredNames`. */
  preferredNames?: PreferredNames
  /** Key names read from user-included headers; unknown names remain raw with a warning. */
  userKeycodes?: UserKeycode[]
}

/** A hold-tap's parameter order and hold kind, for `holdTapInfo`. */
export interface HoldTapInfo extends HoldTapEntry {
  label: string
  order: 'hold-tap' | 'tap-hold'
  holdKind: HoldKind
}

type Slot = 'tap' | 'hold'
type HoldDraft = Extract<Draft, { mode: 'hold' }>
/** The Layer tab's mode: one of the four layer behaviors, or a layer as the hold of a tap key. */
type LayerChoice = LayerMode | 'hold-tap'

/** One selectable row, flattened across sections for keyboard navigation. */
interface Row {
  key: string
  item: PickerItem
  sectionId: string
  sectionLabel: string
}

/** A heading and its rows. */
interface Section {
  id: string
  label: string
  items: PickerItem[]
}

/** Group headings in list order. Letters and digits come last, after the named groups. */
const GROUP_ORDER: readonly { id: GroupId; label: string }[] = [
  ...GROUPS.filter((group) => group.id !== 'keys'),
  ...GROUPS.filter((group) => group.id === 'keys'),
]

/** The footer hint for moving through the list, per navigation scheme. */
const MOVE_HINTS: Record<SchemeName, string> = {
  arrows: '↑↓ move',
  custom: '↑↓ move',
  vim: '↑↓ ⌃J ⌃K move',
  emacs: '↑↓ ⌃N ⌃P move',
}

/** Words for each tab in the search placeholder and the list label. */
const TAB_NOUNS: Record<BehaviorTab, string> = {
  key: 'keys and shortcuts',
  taphold: 'keys',
  layer: 'layers',
  macro: 'macros',
  bluetooth: 'Bluetooth actions',
  mouse: 'mouse actions',
  system: 'system actions',
  empty: 'empty bindings',
}

/** The Layer tab's mode buttons, with the hold-tap option last. */
const LAYER_OPTIONS: readonly { id: LayerChoice; label: string; hint: string }[] = [
  ...LAYER_MODES.map((mode) => ({ id: mode.id, label: mode.label, hint: mode.hint })),
  {
    id: 'hold-tap',
    label: 'Hold + tap key',
    hint: 'Pick a layer to hold, then a key to tap',
  },
]

/** Sorts modifiers into chip order, so wrapping is stable (`LC(LS(K))`). */
function orderMods(mods: readonly ModId[]): ModId[] {
  const rank = (mod: ModId): number =>
    MOD_CHIPS.findIndex((chip) => chip.left === mod || chip.right === mod)
  return [...mods].sort((left, right) => rank(left) - rank(right))
}

/**
 * The glyphs of the modifiers on a key, for the preview line.
 * @param mods - Modifiers in chip order.
 * @returns Glyphs written side by side, e.g. `⌃⇧`.
 */
function modGlyphs(mods: readonly ModId[]): string {
  return mods
    .map((mod) => MOD_CHIPS.find((chip) => chip.left === mod || chip.right === mod)?.glyph ?? mod)
    .join('')
}

/**
 * Short label for a slot choice, shown in the Tap / Hold slots and the preview line.
 * @param choice - The slot's choice, if any.
 * @param layers - Layers, for naming layer holds.
 * @returns Display text, or a dash when the slot is empty.
 */
function choiceLabel(choice: Choice | null, layers: readonly PickerLayer[]): string {
  if (!choice) return '—'
  if (choice.kind === 'key') return resolveKeyCode(choice.code)?.label ?? choice.code
  if (choice.kind === 'layer') {
    return layers.find((layer) => layer.index === choice.layer)?.name ?? `Layer ${choice.layer}`
  }
  if (choice.kind === 'shortcut') return choice.code
  return formatBinding({ behavior: choice.behavior, params: [...choice.params] })
}

/**
 * Keyboard-first picker for a keymap binding. The current binding is a status line, then come
 * the search field, a behavior row (Key, Tap/Hold, Layer, Macro, Bluetooth, Mouse, System,
 * Empty), the tab's own controls, the results, and a collapsed Advanced field for raw ZMK text.
 * @param props - The binding, the keymap's layers, macros and hold-taps, and callbacks.
 * @returns The picker dialog.
 */
export function BindingPicker(props: BindingPickerProps) {
  const { value, layers, macros, holdTaps, onChange, onClose } = props
  const userKeycodes = props.userKeycodes
  const preferredNames = props.preferredNames ?? {}
  const settings = useOptionalSettings()
  const platformSetting: PlatformSetting = props.platform ?? settings?.platform ?? 'auto'
  const platform = useMemo<ResolvedPlatform>(
    () => resolvePlatform(platformSetting),
    [platformSetting],
  )
  const scheme: SchemeName = props.scheme ?? settings?.navigation.scheme ?? 'arrows'
  const { holdTapInfo, macroPreview } = props

  const idBase = useId()
  const listId = `${idBase}-list`
  const holdSpecs = useMemo<HoldTapSpec[]>(
    () => holdTapSpecs([...holdTaps, ...(holdTapInfo ?? [])]),
    [holdTaps, holdTapInfo],
  )
  const macroBehaviors = useMemo(() => macros.map((macro) => `&${macro.name}`), [macros])
  const allItems = useMemo(
    () =>
      buildItems(layers, macros, holdTaps, platform, userKeycodes, macroPreview ?? {}, holdSpecs),
    [layers, macros, holdTaps, platform, userKeycodes, macroPreview, holdSpecs],
  )
  const layerItems = useMemo(() => buildHoldLayerItems(layers), [layers])
  const keyItems = useMemo(() => allItems.filter((item) => item.choice?.kind === 'key'), [allItems])

  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft>(() => draftFromBinding(value, holdSpecs))
  const [tab, setTab] = useState<BehaviorTab>(() =>
    kindOfBinding(value, { holdTaps: holdSpecs, macros: macroBehaviors }),
  )
  const [slot, setSlot] = useState<Slot>('tap')
  const [layerChoice, setLayerChoice] = useState<LayerChoice>(
    () => layerModeOf(value)?.mode ?? 'mo',
  )
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>(() => loadRecent())
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [raw, setRaw] = useState(() => formatBinding(value))
  const [rawTouched, setRawTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rawRef = useRef<HTMLInputElement>(null)
  const focusRawOnOpen = useRef(false)
  const parsedRaw = useMemo(
    () =>
      parseBindingText(
        raw,
        userKeycodes?.map((entry) => entry.name),
      ),
    [raw, userKeycodes],
  )
  const currentRawWarning = useMemo(() => {
    const parsed = parseBindingText(
      formatBinding(value),
      userKeycodes?.map((entry) => entry.name),
    )
    return parsed.ok ? parsed.warning : undefined
  }, [value, userKeycodes])
  const rawError = parsedRaw.ok ? null : parsedRaw.error
  const rawWarning = parsedRaw.ok ? parsedRaw.warning : undefined

  // The Tap/Hold tab always works on a hold draft. A single key chosen elsewhere seeds the tap.
  const holdView: HoldDraft =
    draft.mode === 'hold'
      ? draft
      : {
          mode: 'hold',
          behavior: DEFAULT_HOLD_TAPS[0].behavior,
          tap: draft.choice?.kind === 'key' ? draft.choice : null,
          hold: null,
          mods: draft.mods,
        }
  const holdKind = holdKindOf(holdView.behavior, holdSpecs)
  const showCommon = tab === 'key' || tab === 'taphold'

  // Which rows the current tab can take. The Tap slot takes keys; the Hold slot takes keys
  // (which keep the hold-tap) or layers (which switch it to a layer hold-tap).
  const candidates = useMemo<PickerItem[]>(() => {
    if (tab === 'layer') return layerItems
    if (tab === 'taphold') {
      if (slot === 'tap') return keyItems
      return holdKind === 'layer' ? layerItems : [...keyItems, ...layerItems]
    }
    if (tab === 'key' && query.trim().length > 0) return allItems
    return allItems.filter((item) => item.tab === tab)
  }, [allItems, holdKind, keyItems, layerItems, query, slot, tab])

  const sections = useMemo<Section[]>(() => {
    const ranked = rankEntries(query, candidates, (item) => item)
    if (query.trim().length > 0) {
      // With a query, order groups by their best-ranked member so the top hit leads.
      const bestRank = new Map<GroupId, number>()
      ranked.forEach((item, index) => {
        if (!bestRank.has(item.group)) bestRank.set(item.group, index)
      })
      return [...bestRank.keys()]
        .sort((left, right) => (bestRank.get(left) ?? 0) - (bestRank.get(right) ?? 0))
        .map((groupId) => ({
          id: groupId,
          label: GROUPS.find((group) => group.id === groupId)?.label ?? groupId,
          items: ranked.filter((item) => item.group === groupId),
        }))
    }
    const byId = new Map(candidates.map((item) => [item.id, item]))
    const pick = (ids: readonly string[]): PickerItem[] =>
      ids.flatMap((id) => {
        const item = byId.get(id)
        return item ? [item] : []
      })
    const recentItems = pick(recent)
    const commonItems = showCommon ? pick(commonIds(layers)) : []
    const shown = new Set([...recentItems, ...commonItems].map((item) => item.id))
    const grouped = GROUP_ORDER.map((group) => ({
      id: group.id,
      label: group.label,
      items: ranked.filter((item) => item.group === group.id && !shown.has(item.id)),
    })).filter((section) => section.items.length > 0)
    return [
      ...(recentItems.length > 0 ? [{ id: 'recent', label: 'Recent', items: recentItems }] : []),
      ...(commonItems.length > 0 ? [{ id: 'common', label: 'Common', items: commonItems }] : []),
      ...grouped,
    ]
  }, [candidates, layers, query, recent, showCommon])

  const rows = useMemo<Row[]>(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({
          key: `${section.id}:${item.id}`,
          item,
          sectionId: section.id,
          sectionLabel: section.label,
        })),
      ),
    [sections],
  )
  const rowIndex = useMemo(() => new Map(rows.map((row, index) => [row.key, index])), [rows])

  const current = rows.length === 0 ? 0 : Math.min(active, rows.length - 1)
  const optionId = (index: number): string => `${idBase}-opt-${index}`
  const tabId = (id: BehaviorTab): string => `${idBase}-tab-${id}`

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' })
  }, [current])

  useEffect(() => {
    if (advancedOpen && focusRawOnOpen.current) {
      focusRawOnOpen.current = false
      rawRef.current?.focus()
    }
  }, [advancedOpen])

  /** Finishes the picker with a binding and closes it. */
  function commit(binding: BindingValue, item?: PickerItem): void {
    if (item) setRecent(pushRecent(item.id, recent))
    onChange(binding)
    onClose()
  }

  /**
   * A hold draft that writes the hold-tap's own parameter order.
   * @param parts - The draft's fields other than the mode.
   * @returns The hold draft.
   */
  function holdDraftOf(parts: Omit<HoldDraft, 'mode'>): HoldDraft {
    const order = holdSpecs.find((spec) => spec.behavior === parts.behavior)?.order
    return { mode: 'hold', ...parts, ...(order === 'tap-hold' ? { order } : {}) }
  }

  /** The hold-tap to use for a hold of this kind, keeping the current one when it fits. */
  function behaviorFor(kind: HoldKind, current: string): string {
    if (holdKindOf(current, holdSpecs) === kind) return current
    return holdSpecs.find((spec) => spec.holdKind === kind)?.behavior ?? current
  }

  /** Switches the behavior tab. The query stays, so the search carries across tabs. */
  function switchTab(next: BehaviorTab): void {
    setTab(next)
    setActive(0)
    if (next === 'taphold') setSlot('tap')
  }

  /**
   * Moves to the neighbouring tab, wrapping at the ends.
   * @param direction - 1 for the next tab, -1 for the previous one.
   * @returns The tab moved to.
   */
  function stepTab(direction: 1 | -1): BehaviorTab {
    const index = BEHAVIOR_TABS.findIndex((entry) => entry.id === tab)
    const next = BEHAVIOR_TABS[(index + direction + BEHAVIOR_TABS.length) % BEHAVIOR_TABS.length]
    switchTab(next.id)
    return next.id
  }

  /** Opens the Tap/Hold tab on a hold-tap, with both slots empty. */
  function startHoldTap(behavior: string): void {
    setDraft(holdDraftOf({ behavior, tap: null, hold: null, mods: draft.mods }))
    setTab('taphold')
    setSlot('tap')
    setQuery('')
    setActive(0)
    focusPickerSearch(inputRef.current)
  }

  /** Fills one slot of the Tap/Hold tab. Picking the hold commits when both slots are set. */
  function chooseHold(item: PickerItem): void {
    const choice = item.choice
    if (!choice || (choice.kind !== 'key' && choice.kind !== 'layer')) return
    const behavior =
      slot === 'hold'
        ? behaviorFor(choice.kind === 'layer' ? 'layer' : 'key', holdView.behavior)
        : holdView.behavior
    const next = holdDraftOf({
      behavior,
      tap: slot === 'tap' ? choice : holdView.tap,
      hold: slot === 'hold' ? choice : holdView.hold,
      mods: holdView.mods,
    })
    if (slot === 'hold') {
      const binding = buildBinding(next, preferredNames)
      if (binding) {
        commit(binding, item)
        return
      }
    }
    setDraft(next)
    setSlot(next.tap ? 'hold' : 'tap')
    setQuery('')
    setActive(0)
    focusPickerSearch(inputRef.current)
  }

  /** Writes a layer choice in the Layer tab's mode, or starts a Tap/Hold with it as the hold. */
  function chooseLayer(item: PickerItem): void {
    if (item.choice?.kind !== 'layer') return
    if (layerChoice === 'hold-tap') {
      setDraft(
        holdDraftOf({
          behavior: behaviorFor('layer', DEFAULT_HOLD_TAPS[0].behavior),
          tap: null,
          hold: item.choice,
          mods: draft.mods,
        }),
      )
      setTab('taphold')
      setSlot('tap')
      setQuery('')
      setActive(0)
      focusPickerSearch(inputRef.current)
      return
    }
    commit(layerBinding(layerChoice, item.choice.layer), item)
  }

  /** Applies a picked row to the current tab, committing when the binding is complete. */
  function choose(item: PickerItem): void {
    if (tab === 'taphold') {
      chooseHold(item)
      return
    }
    if (tab === 'layer') {
      chooseLayer(item)
      return
    }
    if (item.dual) {
      startHoldTap(item.dual.behavior)
      return
    }
    const binding = buildBinding(
      { mode: 'single', choice: item.choice ?? null, mods: tab === 'key' ? draft.mods : [] },
      preferredNames,
    )
    if (binding) commit(binding, item)
  }

  /** Sets the hold-tap behavior from the Behavior select, dropping a hold that does not fit it. */
  function setBehavior(behavior: string): void {
    const kind = holdKindOf(behavior, holdSpecs)
    const fits = holdView.hold !== null && (holdView.hold.kind === 'layer') === (kind === 'layer')
    setDraft(
      holdDraftOf({
        behavior,
        tap: holdView.tap,
        hold: fits ? holdView.hold : null,
        mods: holdView.mods,
      }),
    )
  }

  /** Cycles a modifier chip: off, left, right, off. */
  function cycleMod(chip: ModChip): void {
    const isOn = draft.mods.includes(chip.left) || draft.mods.includes(chip.right)
    const isLeft = draft.mods.includes(chip.left)
    const others = draft.mods.filter((mod) => mod !== chip.left && mod !== chip.right)
    let next: ModId[] = others
    if (!isOn) next = [...others, chip.left]
    else if (isLeft) next = [...others, chip.right]
    setDraft({ ...draft, mods: orderMods(next) })
  }

  /** Moves the active row to the first row of the next (or previous) section. */
  function jumpSection(direction: 1 | -1): void {
    const starts = rows.flatMap((row, index) =>
      index === 0 || rows[index - 1].sectionId !== row.sectionId ? [index] : [],
    )
    if (starts.length === 0) return
    let position = 0
    starts.forEach((start, index) => {
      if (start <= current) position = index
    })
    setActive(starts[(position + direction + starts.length) % starts.length])
  }

  /** Opens or closes the Advanced field, moving focus into it when it opens. */
  function toggleAdvanced(): void {
    if (advancedOpen) {
      setAdvancedOpen(false)
      focusPickerSearch(inputRef.current)
      return
    }
    focusRawOnOpen.current = true
    setAdvancedOpen(true)
  }

  /** Handles keys in the search field: tab switching, list movement, then Enter, Escape, Tab. */
  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      stepTab(event.key === 'ArrowLeft' ? -1 : 1)
      return
    }
    const action = pickerKeyAction(eventToToken(event), scheme)
    if (action === 'down' || action === 'up') {
      event.preventDefault()
      if (rows.length === 0) return
      const step = action === 'down' ? 1 : -1
      setActive((current + step + rows.length) % rows.length)
    } else if (action === 'close') {
      event.preventDefault()
      onClose()
    } else if (action === 'select') {
      event.preventDefault()
      // On the Hold slot with the query empty, Enter commits the binding as it stands.
      if (tab === 'taphold' && slot === 'hold' && query.length === 0) {
        const binding = buildBinding(holdView, preferredNames)
        if (binding) {
          commit(binding)
          return
        }
      }
      const row = rows[current]
      if (row) choose(row.item)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (query.length > 0) setQuery('')
      else onClose()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      jumpSection(event.shiftKey ? -1 : 1)
    }
  }

  /** Handles the Advanced ZMK text field. The error appears only after the user edits it. */
  function handleRawKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (parsedRaw.ok) commit(parsedRaw.value)
      else setRawTouched(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  /** Shows a row label, with the characters that match the query highlighted. */
  function renderLabel(label: string): ReactNode {
    if (query.trim().length === 0) return label
    return matchSpans(label, query).map((span, index) =>
      span.hit ? (
        <mark key={index} className="bp-hit">
          {span.text}
        </mark>
      ) : (
        <span key={index}>{span.text}</span>
      ),
    )
  }

  const preview = keycapParts(value, userKeycodes)
  const legend = describeBinding(value, platform, userKeycodes)
  const rawCode =
    value.behavior === '&kp' && value.params.length === 1 ? value.params[0] : formatBinding(value)
  const previewBinding = buildBinding(holdView, preferredNames)
  const tapText = `${modGlyphs(holdView.mods)}${choiceLabel(holdView.tap, layers)}`
  const holdText = choiceLabel(holdView.hold, layers)
  const showMods = tab === 'key' || tab === 'taphold'
  const chipsDisabled = tab === 'taphold' && slot === 'hold'
  const tabName = BEHAVIOR_TABS.find((entry) => entry.id === tab)?.label ?? ''
  const searchLabel =
    tab === 'taphold'
      ? slot === 'tap'
        ? 'Tap key'
        : holdKind === 'layer'
          ? 'Layer for hold'
          : 'Hold key or layer'
      : `Search ${TAB_NOUNS[tab]}`
  const listLabel = tab === 'taphold' ? `Choose the ${slot} action` : `Choose a ${tabName}`
  const activeId = rows.length > 0 ? optionId(current) : undefined
  const moveHint = MOVE_HINTS[scheme]
  const advancedHint = platform === 'mac' ? '⌘E advanced' : 'Ctrl+E advanced'
  const layerHint = LAYER_OPTIONS.find((option) => option.id === layerChoice)?.hint

  return (
    <div
      className="bp"
      role="dialog"
      aria-label="Choose what this key does"
      onKeyDown={(event) => {
        if (event.altKey && /^Digit[1-4]$/.test(event.code)) {
          event.preventDefault()
          cycleMod(MOD_CHIPS[Number(event.code.slice(-1)) - 1])
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
          event.preventDefault()
          toggleAdvanced()
        }
      }}
    >
      <header className="bp-current">
        <kbd className="bp-mini" aria-hidden="true">
          {preview.main}
        </kbd>
        <span className="bp-current-label">
          <span className="bp-visually-hidden">Current binding: </span>
          {legend}
          <code className="bp-raw-code">{rawCode}</code>
        </span>
        {currentRawWarning ? (
          <span className="bp-current-warning" title={currentRawWarning}>
            Raw key
          </span>
        ) : null}
      </header>

      <div className="bp-search">
        <input
          ref={inputRef}
          className="bp-search-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={searchLabel}
          placeholder={`${searchLabel}…`}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={handleSearchKey}
        />
      </div>

      <div
        className="bp-tabs"
        role="radiogroup"
        aria-label="Behavior type"
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const next = stepTab(event.key === 'ArrowLeft' ? -1 : 1)
          document.getElementById(tabId(next))?.focus()
        }}
      >
        {BEHAVIOR_TABS.map((entry) => (
          <button
            key={entry.id}
            id={tabId(entry.id)}
            type="button"
            role="radio"
            className="bp-tab"
            aria-checked={tab === entry.id}
            tabIndex={tab === entry.id ? 0 : -1}
            onClick={() => {
              switchTab(entry.id)
              focusPickerSearch(inputRef.current)
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'taphold' ? (
        <div className="bp-taphold">
          <div className="bp-slots" role="group" aria-label="Tap or hold">
            <button
              type="button"
              className="bp-slot"
              aria-pressed={slot === 'tap'}
              onClick={() => {
                setSlot('tap')
                setActive(0)
                focusPickerSearch(inputRef.current)
              }}
            >
              <span className="bp-slot-name">Tap</span>
              <span className="bp-slot-value">{choiceLabel(holdView.tap, layers)}</span>
            </button>
            <button
              type="button"
              className="bp-slot"
              aria-pressed={slot === 'hold'}
              onClick={() => {
                setSlot('hold')
                setActive(0)
                focusPickerSearch(inputRef.current)
              }}
            >
              <span className="bp-slot-name">Hold</span>
              <span className="bp-slot-value">{choiceLabel(holdView.hold, layers)}</span>
            </button>
          </div>
          <div className="bp-behavior-row">
            <label className="bp-behavior">
              <span>Behavior</span>
              <select
                value={holdView.behavior}
                onChange={(event) => setBehavior(event.target.value)}
              >
                {holdSpecs.map((spec) => (
                  <option
                    key={spec.behavior}
                    value={spec.behavior}
                    title={
                      spec.order === 'tap-hold'
                        ? 'Written tap, then hold'
                        : 'Written hold, then tap'
                    }
                  >
                    {spec.behavior.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="bp-preview-line" aria-live="polite">
            <span>{`Tap: ${tapText} · Hold: ${holdText}`}</span>
            {previewBinding ? (
              <code className="bp-preview-code">{formatBinding(previewBinding)}</code>
            ) : null}
          </p>
        </div>
      ) : null}

      {tab === 'layer' ? (
        <div className="bp-modes" role="group" aria-label="Layer mode">
          {LAYER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="bp-mode"
              aria-pressed={layerChoice === option.id}
              title={option.hint}
              onClick={() => {
                setLayerChoice(option.id)
                focusPickerSearch(inputRef.current)
              }}
            >
              {option.label}
            </button>
          ))}
          <p className="bp-mode-hint">{layerHint}</p>
        </div>
      ) : null}

      {showMods ? (
        <div className="bp-mods" role="group" aria-label="Modifiers for the key">
          {MOD_CHIPS.map((chip, index) => {
            const isLeft = draft.mods.includes(chip.left)
            const isRight = draft.mods.includes(chip.right)
            const side = isLeft ? 'L' : isRight ? 'R' : ''
            return (
              <button
                key={chip.family}
                type="button"
                className="bp-chip"
                aria-pressed={isLeft || isRight}
                aria-label={`${chip.label}${side ? (isLeft ? ', left' : ', right') : ''}`}
                aria-keyshortcuts={`Alt+${index + 1}`}
                disabled={chipsDisabled}
                title={`${chip.label} (Alt+${index + 1}): off, left, right`}
                onClick={() => {
                  cycleMod(chip)
                  focusPickerSearch(inputRef.current)
                }}
              >
                <span aria-hidden="true">{chip.glyph}</span>
                {side ? <sup aria-hidden="true">{side}</sup> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {tab === 'key' && query.trim().length > 0 ? (
        <div className="bp-scope" aria-hidden="true">
          All
        </div>
      ) : null}
      <div id={listId} role="listbox" aria-label={listLabel} className="bp-list">
        {rows.length === 0 ? <p className="bp-empty">No matches</p> : null}
        {sections.map((section) => (
          <div key={section.id} role="group" aria-label={section.label} className="bp-section">
            <div className="bp-section-label" aria-hidden="true">
              {section.label}
            </div>
            {section.items.map((item) => {
              const index = rowIndex.get(`${section.id}:${item.id}`) ?? -1
              const isActive = index === current
              return (
                <div
                  key={`${section.id}:${item.id}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive}
                  className="bp-row"
                  data-active={isActive}
                  onMouseMove={() => {
                    if (!isActive) setActive(index)
                  }}
                  onMouseDown={(event) => preservePickerSearchFocus(event, inputRef.current)}
                  onClick={() => choose(item)}
                >
                  <span className="bp-glyph" aria-hidden="true">
                    {item.glyph ?? item.label.charAt(0)}
                  </span>
                  <span className="bp-label">
                    <span>{renderLabel(item.label)}</span>
                    {item.note ? <small className="bp-note">{item.note}</small> : null}
                  </span>
                  <code className="bp-code">{item.code}</code>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <details
        className="bp-advanced"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary>Advanced</summary>
        <div className="bp-raw">
          <label className="bp-visually-hidden" htmlFor={`${idBase}-raw`}>
            ZMK binding text
          </label>
          <input
            ref={rawRef}
            id={`${idBase}-raw`}
            className="bp-raw-input"
            value={raw}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={rawTouched && rawError !== null}
            aria-describedby={rawTouched && rawError ? `${idBase}-raw-error` : undefined}
            onChange={(event) => {
              setRaw(event.target.value)
              setRawTouched(true)
            }}
            onKeyDown={handleRawKey}
          />
          {rawTouched && rawError ? (
            <p id={`${idBase}-raw-error`} className="bp-raw-error" role="alert">
              {rawError}
            </p>
          ) : null}
          {advancedOpen && rawWarning ? (
            <p className="bp-raw-warning" role="status">
              {rawWarning}
            </p>
          ) : null}
        </div>
      </details>

      <footer className="bp-foot" aria-hidden="true">
        <span>{moveHint}</span>
        <span>↵ select</span>
        <span>⇥ group</span>
        <span>⌥←→ type</span>
        <span>esc close</span>
        <span>⌥1–4 modifiers</span>
        <span>{advancedHint}</span>
      </footer>
    </div>
  )
}
