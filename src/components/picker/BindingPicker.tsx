import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { GROUPS, resolveKeyCode, type GroupId } from '../../lib/keycodes/catalog'
import {
  buildBinding,
  draftFromBinding,
  formatBinding,
  MOD_CHIPS,
  parseBindingText,
  type BindingValue,
  type Choice,
  type Draft,
  type ModChip,
  type ModId,
} from '../../lib/keycodes/binding'
import { rankEntries } from '../../lib/keycodes/fuzzy'
import {
  buildHoldLayerItems,
  buildItems,
  keycapParts,
  loadRecent,
  pushRecent,
  type PickerHoldTap,
  type PickerItem,
  type PickerLayer,
  type PickerMacro,
} from './items'
import './picker.css'

/** Props for the binding picker. */
export interface BindingPickerProps {
  /** The binding being edited. */
  value: BindingValue
  layers: PickerLayer[]
  macros: PickerMacro[]
  holdTaps: PickerHoldTap[]
  /** Called once with the finished binding. */
  onChange: (binding: BindingValue) => void
  /** Called when the picker should close, after a commit or on Escape. */
  onClose: () => void
}

type Slot = 'tap' | 'hold'

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

/** Sorts modifiers into chip order, so wrapping is stable (`LC(LS(K))`). */
function orderMods(mods: readonly ModId[]): ModId[] {
  const rank = (mod: ModId): number =>
    MOD_CHIPS.findIndex((chip) => chip.left === mod || chip.right === mod)
  return [...mods].sort((left, right) => rank(left) - rank(right))
}

/**
 * Short label for a slot choice, shown in the Tap / Hold switch.
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
  return formatBinding({ behavior: choice.behavior, params: [...choice.params] })
}

/**
 * Minimal, keyboard-first picker for a keymap binding: one search field, grouped results,
 * modifier chips that wrap the chosen key, and a Tap / Hold slot for dual-role behaviors.
 * @param props - The binding, the keymap's layers, macros and hold-taps, and callbacks.
 * @returns The picker dialog.
 */
export function BindingPicker(props: BindingPickerProps) {
  const { value, layers, macros, holdTaps, onChange, onClose } = props
  const idBase = useId()
  const listId = `${idBase}-list`
  const allItems = useMemo(() => buildItems(layers, macros, holdTaps), [layers, macros, holdTaps])
  const holdLayerItems = useMemo(() => buildHoldLayerItems(layers), [layers])
  const itemById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems])

  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft>(() => draftFromBinding(value))
  const [slot, setSlot] = useState<Slot>('tap')
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>(() => loadRecent())
  const [raw, setRaw] = useState(() => formatBinding(value))
  const [rawError, setRawError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const holdMode = draft.mode === 'hold'
  const holdLayers = holdMode && draft.behavior === '&lt'

  // Which rows the current slot can take. Tap takes keys; hold takes keys or, for layer-tap,
  // layers.
  const candidates = useMemo<PickerItem[]>(() => {
    if (!holdMode) return allItems
    if (slot === 'hold' && holdLayers) return holdLayerItems
    return allItems.filter((item) => item.choice?.kind === 'key')
  }, [allItems, holdLayerItems, holdMode, holdLayers, slot])

  const sections = useMemo<Section[]>(() => {
    const ranked = rankEntries(query, candidates, (item) => item)
    if (query.trim().length === 0) {
      const byId = new Set(candidates.map((item) => item.id))
      const recentItems = recent
        .filter((id) => byId.has(id))
        .map((id) => itemById.get(id))
        .filter((item): item is PickerItem => item !== undefined)
      const grouped = GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        items: ranked.filter((item) => item.group === group.id),
      })).filter((section) => section.items.length > 0)
      return recentItems.length > 0
        ? [{ id: 'recent', label: 'Recent', items: recentItems }, ...grouped]
        : grouped
    }
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
  }, [candidates, query, recent, itemById])

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

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' })
  }, [current])

  /** Finishes the picker with a binding and closes it. */
  function commit(binding: BindingValue, item?: PickerItem): void {
    if (item) setRecent(pushRecent(item.id, recent))
    onChange(binding)
    onClose()
  }

  /** Applies a picked row to the draft, committing when the binding is complete. */
  function choose(item: PickerItem): void {
    if (draft.mode === 'single') {
      if (item.dual) {
        setDraft({ mode: 'hold', behavior: item.dual.behavior, tap: null, hold: null, mods: draft.mods })
        setSlot('tap')
        setQuery('')
        setActive(0)
        inputRef.current?.focus()
        return
      }
      const next: Draft = { mode: 'single', choice: item.choice ?? null, mods: draft.mods }
      const binding = buildBinding(next)
      if (binding) commit(binding, item)
      return
    }
    const next: Draft =
      slot === 'tap'
        ? { ...draft, tap: item.choice ?? null }
        : { ...draft, hold: item.choice ?? null }
    const binding = buildBinding(next)
    if (binding) {
      commit(binding, item)
      return
    }
    setDraft(next)
    setSlot(slot === 'tap' ? 'hold' : 'tap')
    setQuery('')
    setActive(0)
    inputRef.current?.focus()
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

  /** Handles keys in the search field. */
  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (rows.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + rows.length) % rows.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
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

  /** Handles the advanced ZMK text field. */
  function handleRawKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      const parsed = parseBindingText(raw)
      if (parsed.ok) commit(parsed.value)
      else setRawError(parsed.error)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const preview = keycapParts(value)
  const chipsDisabled = holdMode && slot === 'hold'
  const listLabel = holdMode ? `Choose the ${slot === 'tap' ? 'tap' : 'hold'} action` : 'Choose a binding'
  const activeId = rows.length > 0 ? optionId(current) : undefined

  return (
    <div
      className="bp"
      role="dialog"
      aria-label="Choose what this key does"
      onKeyDown={(event) => {
        if (event.altKey && /^Digit[1-4]$/.test(event.code)) {
          event.preventDefault()
          cycleMod(MOD_CHIPS[Number(event.code.slice(-1)) - 1])
        }
      }}
    >
      <header className="bp-head">
        <div className="bp-keycap" aria-hidden="true">
          {preview.mods.map((glyph, index) => (
            <span key={`${glyph}-${index}`} className="bp-keycap-mod">
              {glyph}
            </span>
          ))}
          <kbd>{preview.main}</kbd>
          {preview.detail ? <span className="bp-keycap-detail">{preview.detail}</span> : null}
        </div>
        <div className="bp-raw">
          <label className="bp-visually-hidden" htmlFor={`${idBase}-raw`}>
            ZMK binding text
          </label>
          <input
            id={`${idBase}-raw`}
            className="bp-raw-input"
            value={raw}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={rawError !== null}
            aria-describedby={rawError ? `${idBase}-raw-error` : undefined}
            onChange={(event) => {
              setRaw(event.target.value)
              const parsed = parseBindingText(event.target.value)
              setRawError(parsed.ok ? null : parsed.error)
            }}
            onKeyDown={handleRawKey}
          />
          {rawError ? (
            <p id={`${idBase}-raw-error`} className="bp-raw-error" role="alert">
              {rawError}
            </p>
          ) : null}
        </div>
      </header>

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
              onClick={() => cycleMod(chip)}
            >
              <span aria-hidden="true">{chip.glyph}</span>
              {side ? <sup aria-hidden="true">{side}</sup> : null}
            </button>
          )
        })}
      </div>

      {holdMode ? (
        <div className="bp-slots" role="group" aria-label="Tap or hold">
          <button
            type="button"
            className="bp-slot"
            aria-pressed={slot === 'tap'}
            onClick={() => {
              setSlot('tap')
              setActive(0)
              inputRef.current?.focus()
            }}
          >
            <span className="bp-slot-name">Tap</span>
            <span className="bp-slot-value">{choiceLabel(draft.tap, layers)}</span>
          </button>
          <button
            type="button"
            className="bp-slot"
            aria-pressed={slot === 'hold'}
            onClick={() => {
              setSlot('hold')
              setActive(0)
              inputRef.current?.focus()
            }}
          >
            <span className="bp-slot-name">Hold</span>
            <span className="bp-slot-value">{choiceLabel(draft.hold, layers)}</span>
          </button>
        </div>
      ) : null}

      <div className="bp-search">
        <input
          ref={inputRef}
          className="bp-search-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={holdMode && slot === 'hold' && holdLayers ? 'Search layers' : 'Search keys and actions'}
          placeholder={
            holdMode && slot === 'hold' && holdLayers
              ? 'Layer for hold…'
              : holdMode
                ? `${slot === 'tap' ? 'Tap' : 'Hold'} key…`
                : 'Search keys, layers, macros…'
          }
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
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                >
                  <span className="bp-glyph" aria-hidden="true">
                    {item.glyph ?? item.label.charAt(0)}
                  </span>
                  <span className="bp-label">{item.label}</span>
                  <code className="bp-code">{item.code}</code>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <footer className="bp-foot" aria-hidden="true">
        <span>↑↓ move</span>
        <span>↵ select</span>
        <span>⇥ group</span>
        <span>esc close</span>
        <span>⌥1–4 modifiers</span>
      </footer>
    </div>
  )
}
