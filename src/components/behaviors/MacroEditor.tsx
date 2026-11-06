import { useMemo, useRef, useState } from 'react'
import type { Behavior } from '../../lib/zmk'
import { useEditor } from '../../lib/editor-state'
import {
  STEP_KINDS,
  macroChanges,
  macroFormOf,
  macroOpaqueReason,
  macroPreview,
  macroProblems,
  moveItem,
  stepFrom,
  stepProblem,
  stepText,
  type MacroForm,
  type MacroStep,
} from './forms'
import { ApplyBar, NumberField, messageOf } from './parts'

/** Props for the macro editor. */
export interface MacroEditorProps {
  macro: Behavior
}

/** A step with a stable identity, so rows keep focus while they move. */
interface Row {
  id: number
  step: MacroStep
}

const kindLabel = (kind: MacroStep['kind']) =>
  STEP_KINDS.find((entry) => entry.kind === kind)?.label ?? kind

/**
 * Edit a macro's ordered steps and timing. Rows reorder by dragging, or with Alt+Up / Alt+Down.
 * Opaque macros are shown read-only with the reason.
 * @param props - The macro to edit.
 * @returns The editor.
 */
export function MacroEditor({ macro }: MacroEditorProps) {
  const opaque = macroOpaqueReason(macro)
  if (opaque) return <OpaqueMacro macro={macro} reason={opaque} />
  return <EditableMacro macro={macro} />
}

function OpaqueMacro({ macro, reason }: { macro: Behavior; reason: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p role="note" className="rounded-md border border-subtle p-3 text-sm text-secondary">
        <strong className="text-primary">Read-only.</strong> {reason}
      </p>
      <ol className="flex flex-col gap-1 font-mono text-xs text-secondary">
        {macro.bindings.map((binding, index) => (
          <li key={`${index}:${binding.text}`}>{binding.text}</li>
        ))}
      </ol>
    </div>
  )
}

function EditableMacro({ macro }: { macro: Behavior }) {
  const editor = useEditor()
  const original = useMemo(() => macroFormOf(macro), [macro])
  const nextId = useRef(original.steps.length)
  const [rows, setRows] = useState<Row[]>(() => original.steps.map((step, id) => ({ id, step })))
  const [tapMs, setTapMs] = useState(original.tapMs)
  const [waitMs, setWaitMs] = useState(original.waitMs)
  const [kind, setKind] = useState<MacroStep['kind']>('tap')
  const [draftText, setDraftText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const dragFrom = useRef<number | null>(null)

  const steps = rows.map((row) => row.step)
  const form: MacroForm = { steps, tapMs, waitMs }
  const problems = macroProblems(form, original)
  const dirty = JSON.stringify(form) !== JSON.stringify(original)
  const draftStep = stepFrom(kind, draftText)
  const draftProblem = draftText.trim() === '' ? 'Enter a value to add.' : stepProblem(draftStep)

  const focusRow = (id: number) =>
    window.requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>(`[data-step-id="${id}"]`)?.focus(),
    )
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return
    setRows(moveItem(rows, from, to))
    focusRow(rows[from].id)
  }
  const edit = (id: number, text: string) =>
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              step:
                row.step.kind === 'behavior'
                  ? { ...row.step, text }
                  : stepFrom(row.step.kind, text),
            }
          : row,
      ),
    )
  const remove = (id: number) => setRows((current) => current.filter((row) => row.id !== id))
  const add = () => {
    if (draftProblem) return
    nextId.current += 1
    setRows((current) => [...current, { id: nextId.current, step: draftStep }])
    setDraftText('')
  }
  const apply = () => {
    try {
      const changes = macroChanges(original, form)
      if (Object.keys(changes).length) editor.updateMacro(macro.name, changes)
      setError(null)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }
  const revert = () => {
    nextId.current = original.steps.length
    setRows(original.steps.map((step, id) => ({ id, step })))
    setTapMs(original.tapMs)
    setWaitMs(original.waitMs)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-md border border-subtle bg-canvas p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">What it types</h3>
        <p className="text-sm">{macroPreview(steps, { tapMs, waitMs })}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Steps</h3>
        <p className="text-xs text-muted">
          Drag a step to move it, or select it and press Alt+↑ or Alt+↓.
        </p>
        {rows.length ? (
          <ol ref={listRef} className="flex flex-col gap-2" aria-label="Macro steps">
            {rows.map((row, index) => (
              <li
                key={row.id}
                data-step-id={row.id}
                tabIndex={0}
                draggable
                aria-label={`Step ${index + 1}, ${kindLabel(row.step.kind)}`}
                aria-invalid={problems[`step${index}`] ? true : undefined}
                onDragStart={() => {
                  dragFrom.current = index
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragFrom.current !== null) setRows(moveItem(rows, dragFrom.current, index))
                  dragFrom.current = null
                }}
                onKeyDown={(event) => {
                  if (!event.altKey) return
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    move(index, index + (event.key === 'ArrowUp' ? -1 : 1))
                  }
                }}
                className="flex flex-wrap items-center gap-2 rounded-md border border-subtle bg-raised p-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <span aria-hidden className="cursor-grab select-none text-muted">
                  ⠿
                </span>
                <span className="w-5 text-xs text-muted">{index + 1}</span>
                <span className="w-32 text-xs text-secondary">{kindLabel(row.step.kind)}</span>
                <input
                  aria-label={`Value for step ${index + 1}`}
                  value={stepText(row.step)}
                  onChange={(event) => edit(row.id, event.target.value)}
                  className="min-w-0 flex-1 rounded border border-subtle bg-canvas px-2 py-1 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  aria-label={`Remove step ${index + 1}`}
                  className="rounded px-2 text-sm text-secondary hover:bg-hover"
                >
                  ✕
                </button>
                {problems[`step${index}`] ? (
                  <p className="basis-full text-xs text-status-error">{problems[`step${index}`]}</p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">No steps yet. Add one below.</p>
        )}
      </section>

      <section aria-labelledby="macro-add" className="flex flex-col gap-2">
        <h3 id="macro-add" className="text-sm font-semibold">
          Add a step
        </h3>
        <div className="flex flex-wrap items-start gap-2">
          <select
            aria-label="Step type"
            value={kind}
            onChange={(event) => setKind(event.target.value as MacroStep['kind'])}
            className="rounded-md border border-subtle bg-canvas px-2 py-1 text-sm"
          >
            {STEP_KINDS.map((entry) => (
              <option key={entry.kind} value={entry.kind}>
                {entry.label}
              </option>
            ))}
          </select>
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <input
              aria-label="New step value"
              aria-invalid={Boolean(draftText && draftProblem) || undefined}
              placeholder={
                kind === 'wait' || kind === 'tapTime'
                  ? '50'
                  : kind === 'behavior'
                    ? '&kp A'
                    : 'A or LS(A)'
              }
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') add()
              }}
              className="rounded-md border border-subtle bg-canvas px-2 py-1 font-mono text-sm"
            />
            {draftText && draftProblem ? (
              <p className="text-xs text-status-error">{draftProblem}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={add}
            disabled={Boolean(draftProblem)}
            className="rounded-md border border-subtle px-3 py-1 text-sm hover:bg-hover disabled:opacity-40"
          >
            Add step
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Timing</h3>
        <NumberField
          id="macro-tap"
          label="Tap duration"
          unit="ms"
          min={0}
          max={10000}
          value={tapMs}
          problem={problems.tapMs}
          help="How long each key stays down."
          onChange={setTapMs}
        />
        <NumberField
          id="macro-wait"
          label="Gap between keys"
          unit="ms"
          min={0}
          max={10000}
          value={waitMs}
          problem={problems.waitMs}
          help="Pause after each key, unless a wait step says otherwise."
          onChange={setWaitMs}
        />
      </section>

      <ApplyBar dirty={dirty} problems={problems} error={error} onApply={apply} onRevert={revert} />
    </div>
  )
}
