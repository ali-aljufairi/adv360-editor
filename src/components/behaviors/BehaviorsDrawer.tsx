import { useState } from 'react'
import type { Behavior, Combo, Model } from '../../lib/zmk'
import { useEditor } from '../../lib/editor-state'
import { SidePanel } from '../editor/SidePanel'
import { ComboEditor } from './ComboEditor'
import { HoldTapEditor } from './HoldTapEditor'
import { MacroEditor } from './MacroEditor'
import { conditionLabel, holdTapSummary, keysUsing, macroOpaqueReason, macroStepsOf } from './forms'

/** The three sections of the drawer. */
export type BehaviorTab = 'hold-taps' | 'macros' | 'combos'

const TABS: { id: BehaviorTab; label: string }[] = [
  { id: 'hold-taps', label: 'Hold-taps' },
  { id: 'macros', label: 'Macros' },
  { id: 'combos', label: 'Combos' },
]

/** Props for the drawer. */
export interface BehaviorsDrawerProps {
  open: boolean
  onClose(): void
}

/**
 * A right-hand drawer that lists and edits hold-taps, macros and combos.
 * @param props - Whether it is open and how to close it.
 * @returns The drawer, or nothing while closed.
 */
export function BehaviorsDrawer({ open, onClose }: BehaviorsDrawerProps) {
  if (!open) return null
  return <Panel onClose={onClose} />
}

interface Selection {
  tab: BehaviorTab
  name: string
}

function Panel({ onClose }: { onClose(): void }) {
  const editor = useEditor()
  const [tab, setTab] = useState<BehaviorTab>('hold-taps')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [adding, setAdding] = useState(false)
  const { model, layout } = editor
  const holdTaps = model.behaviors.filter((item) => item.compatible === 'zmk,behavior-hold-tap')
  const selectedName = selection?.tab === tab ? selection.name : null
  const behaviors = tab === 'macros' ? model.macros : tab === 'hold-taps' ? holdTaps : []
  const selectedBehavior = behaviors.find((item) => item.name === selectedName)
  const selectedCombo =
    tab === 'combos' ? model.combos.find((item) => item.name === selectedName) : undefined
  const showEditor = Boolean(selectedBehavior || selectedCombo || (tab === 'combos' && adding))
  const pick = (name: string) => {
    setAdding(false)
    setSelection({ tab, name })
  }
  const switchTab = (next: BehaviorTab) => {
    setTab(next)
    setAdding(false)
  }

  return (
    <SidePanel title="Behaviors" onClose={onClose}>
      {showEditor ? (
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => {
              setSelection(null)
              setAdding(false)
            }}
            className="px-2 py-1 text-sm text-secondary hover:text-primary"
          >
            ← All {TABS.find((entry) => entry.id === tab)?.label.toLowerCase()}
          </button>
        </div>
      ) : null}

      {showEditor ? null : (
        <div
          role="tablist"
          aria-label="Behavior type"
          className="sticky top-0 z-10 flex gap-1 border-b border-subtle bg-raised px-3"
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => switchTab(entry.id)}
              className={`border-b-2 px-3 py-2 text-sm ${tab === entry.id ? 'border-accent-primary font-medium' : 'border-transparent text-secondary hover:bg-hover'}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-4">
        {showEditor && tab === 'hold-taps' && selectedBehavior ? (
          <HoldTapEditor
            key={JSON.stringify(selectedBehavior.properties)}
            behavior={selectedBehavior}
            model={model}
            keys={layout.keys}
          />
        ) : null}
        {showEditor && tab === 'macros' && selectedBehavior ? (
          <MacroEditor
            key={JSON.stringify(selectedBehavior.bindings.map((item) => item.text))}
            macro={selectedBehavior}
          />
        ) : null}
        {showEditor && tab === 'combos' ? (
          <ComboEditor
            key={
              selectedCombo
                ? JSON.stringify([
                    selectedCombo.name,
                    selectedCombo.bindings,
                    selectedCombo.keyPositions,
                    selectedCombo.timeoutMs,
                    selectedCombo.layers,
                  ])
                : 'new'
            }
            combo={selectedCombo ?? null}
            combos={model.combos}
            model={model}
            keys={layout.keys}
            onDone={() => {
              setSelection(null)
              setAdding(false)
            }}
            onSaved={(name) => setSelection({ tab: 'combos', name })}
          />
        ) : null}
        {!showEditor && tab === 'hold-taps' ? (
          <HoldTapList items={holdTaps} model={model} onPick={pick} />
        ) : null}
        {!showEditor && tab === 'macros' ? <MacroList items={model.macros} onPick={pick} /> : null}
        {!showEditor && tab === 'combos' ? (
          <ComboList
            items={model.combos}
            onPick={pick}
            onAdd={() => {
              setSelection(null)
              setAdding(true)
            }}
          />
        ) : null}
      </div>
    </SidePanel>
  )
}

const ROW =
  'flex w-full flex-col gap-0.5 rounded-md border border-subtle px-3 py-2 text-left hover:bg-hover'

function HoldTapList({
  items,
  model,
  onPick,
}: {
  items: Behavior[]
  model: Model
  onPick(name: string): void
}) {
  if (!items.length) return <p className="text-sm text-muted">No hold-taps in this keymap.</p>
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const uses = keysUsing(
          model,
          [item.name, item.label].filter((name): name is string => Boolean(name)),
        )
        return (
          <li key={item.name}>
            <button type="button" className={ROW} onClick={() => onPick(item.name)}>
              <span className="text-sm font-medium">{item.label ?? item.name}</span>
              <span className="text-xs text-muted">{holdTapSummary(item, uses.length)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function MacroList({ items, onPick }: { items: Behavior[]; onPick(name: string): void }) {
  if (!items.length) return <p className="text-sm text-muted">No macros in this keymap.</p>
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const reason = macroOpaqueReason(item)
        return (
          <li key={item.name}>
            <button type="button" className={ROW} onClick={() => onPick(item.name)}>
              <span className="text-sm font-medium">{item.label ?? item.name}</span>
              <span className="text-xs text-muted">
                {reason ? 'Read-only' : `${macroStepsOf(item.bindings).length} steps`}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ComboList({
  items,
  onPick,
  onAdd,
}: {
  items: Combo[]
  onPick(name: string): void
  onAdd(): void
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onAdd}
        className="self-start rounded-md border border-subtle px-3 py-1 text-sm hover:bg-hover"
      >
        Add combo
      </button>
      {items.length ? null : <p className="text-sm text-muted">No combos in this keymap.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.name}>
            <button type="button" className={ROW} onClick={() => onPick(item.name)}>
              <span className="font-mono text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted">
                keys {item.keyPositions.join(', ')} ·{' '}
                {item.bindings.map((binding) => binding.text).join(' ')}
                {conditionLabel(item.condition) ? ` · ${conditionLabel(item.condition)}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
