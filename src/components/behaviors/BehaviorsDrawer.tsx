import { useRef, useState } from 'react'
import type { Behavior, Combo, Model } from '../../lib/zmk'
import { useEditor } from '../../lib/editor-state'
import { useFocusTrap } from '../panels/useFocusTrap'
import { ComboEditor } from './ComboEditor'
import { HoldTapEditor } from './HoldTapEditor'
import { MacroEditor } from './MacroEditor'
import { conditionLabel, keysUsing, macroOpaqueReason, macroStepsOf } from './forms'

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
  const panel = useRef<HTMLElement>(null)
  useFocusTrap(panel, true, onClose)
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
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Behaviors"
        className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-subtle bg-raised text-primary shadow-[var(--shadow-float)]"
      >
        <header className="flex items-center gap-3 border-b border-subtle px-4 py-3">
          {showEditor ? (
            <button
              type="button"
              onClick={() => {
                setSelection(null)
                setAdding(false)
              }}
              className="rounded-md px-2 py-1 text-sm text-secondary hover:bg-hover"
            >
              ← All {TABS.find((entry) => entry.id === tab)?.label.toLowerCase()}
            </button>
          ) : (
            <h2 className="text-base font-semibold">Behaviors</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close behaviors"
            className="ml-auto rounded-md px-2 py-1 text-secondary hover:bg-hover"
          >
            ✕
          </button>
        </header>

        {showEditor ? null : (
          <div
            role="tablist"
            aria-label="Behavior type"
            className="flex gap-1 border-b border-subtle px-3"
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

        <div className="flex-1 overflow-y-auto px-4 py-4">
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
          {!showEditor && tab === 'macros' ? (
            <MacroList items={model.macros} onPick={pick} />
          ) : null}
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
      </aside>
    </div>
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
              <span className="text-xs text-muted">
                {item.properties['tapping-term-ms'] ?? '—'} · used on {uses.length}{' '}
                {uses.length === 1 ? 'key' : 'keys'}
              </span>
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
