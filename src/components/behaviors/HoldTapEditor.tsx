import { useMemo, useState } from 'react'
import type { Behavior, Model, PhysicalKey } from '../../lib/zmk'
import { useEditor } from '../../lib/editor-state'
import {
  FLAVORS,
  holdTapChanges,
  holdTapFormOf,
  holdTapProblems,
  keysUsing,
  toggleIndex,
  type HoldTapForm,
} from './forms'
import { ApplyBar, Field, KeyBoard, NumberField, messageOf } from './parts'

/** Props for the hold-tap editor. */
export interface HoldTapEditorProps {
  behavior: Behavior
  model: Model
  keys: readonly PhysicalKey[]
}

/**
 * Edit a hold-tap's timing, flavor and hold-trigger keys. Bindings can be edited.
 * @param props - The hold-tap, the resolved model and the board's keys.
 * @returns The editor.
 */
export function HoldTapEditor({ behavior, model, keys }: HoldTapEditorProps) {
  const editor = useEditor()
  const original = useMemo(() => holdTapFormOf(behavior), [behavior])
  const [form, setForm] = useState<HoldTapForm>(original)
  const [positionText, setPositionText] = useState(original.holdTriggerKeyPositions.join(' '))
  const [error, setError] = useState<string | null>(null)
  const problems = holdTapProblems(form, keys.length, original)
  const dirty = JSON.stringify(form) !== JSON.stringify(original)
  const names = [behavior.name, behavior.label].filter((item): item is string => Boolean(item))
  const uses = keysUsing(model, names)
  const update = (changes: Partial<HoldTapForm>) =>
    setForm((previous) => ({ ...previous, ...changes }))

  const setPositions = (next: number[]) => {
    update({ holdTriggerKeyPositions: next })
    setPositionText(next.join(' '))
  }
  const apply = () => {
    try {
      const changes = holdTapChanges(original, form)
      if (Object.keys(changes).length) editor.updateHoldTap(behavior.name, changes)
      setError(null)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="ht-flavor" className="flex flex-col gap-2">
        <h3 id="ht-flavor" className="text-sm font-semibold">
          Flavor
        </h3>
        <div role="radiogroup" aria-labelledby="ht-flavor" className="flex flex-col gap-2">
          {FLAVORS.map((flavor) => (
            <label
              key={flavor.value}
              className="flex cursor-pointer gap-2 rounded-md border border-subtle p-2 hover:bg-hover"
            >
              <input
                type="radio"
                name="flavor"
                value={flavor.value}
                checked={form.flavor === flavor.value}
                onChange={() => update({ flavor: flavor.value })}
                className="mt-1"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{flavor.label}</span>
                <span className="text-xs text-muted">{flavor.help}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Timing</h3>
        <NumberField
          id="ht-term"
          label="Tapping term"
          unit="ms"
          min={1}
          max={2000}
          slider
          value={form.tappingTermMs}
          problem={problems.tappingTermMs}
          help="How long a key must be held before it counts as a hold."
          onChange={(value) => update({ tappingTermMs: value })}
        />
        <NumberField
          id="ht-quick"
          label="Quick-tap window"
          unit="ms"
          min={0}
          max={1000}
          value={form.quickTapMs}
          problem={problems.quickTapMs}
          help="Pressing the key again within this window repeats the tap instead of holding."
          onChange={(value) => update({ quickTapMs: value })}
        />
        <NumberField
          id="ht-idle"
          label="Require idle before"
          unit="ms"
          min={0}
          max={5000}
          value={form.requirePriorIdleMs}
          problem={problems.requirePriorIdleMs}
          help="Resolve as a tap if a non-modifier key was pressed within this many ms."
          onChange={(value) => update({ requirePriorIdleMs: value })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Hold-trigger keys</h3>
        <p className="text-xs text-muted">
          Keys that, when pressed during the hold, make it resolve as a hold. Click keys on the
          board or type their numbers.
        </p>
        <KeyBoard
          keys={keys}
          selected={form.holdTriggerKeyPositions}
          label="Hold-trigger keys"
          onToggle={(index) => setPositions(toggleIndex(form.holdTriggerKeyPositions, index))}
        />
        <Field
          id="ht-positions"
          label="Positions (space separated)"
          problem={problems.holdTriggerKeyPositions}
        >
          <input
            id="ht-positions"
            value={positionText}
            aria-invalid={problems.holdTriggerKeyPositions ? true : undefined}
            onChange={(event) => {
              setPositionText(event.target.value)
              update({
                holdTriggerKeyPositions: event.target.value
                  .split(/[\s,]+/)
                  .filter(Boolean)
                  .map(Number),
              })
            }}
            className="rounded-md border border-subtle bg-canvas px-2 py-1 font-mono text-sm"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.holdTriggerOnRelease}
            onChange={(event) => update({ holdTriggerOnRelease: event.target.checked })}
          />
          Hold-trigger on release
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.retroTap}
            onChange={(event) => update({ retroTap: event.target.checked })}
          />
          Retro tap
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Wrapped bindings</h3>
        {form.bindings.map((binding, index) => (
          <Field
            key={index}
            id={`ht-binding-${index}`}
            label={index === 0 ? 'Hold binding' : 'Tap binding'}
            problem={problems.bindings}
          >
            <input
              id={`ht-binding-${index}`}
              value={binding}
              onChange={(event) =>
                update({
                  bindings: form.bindings.map((item, i) =>
                    i === index ? event.target.value : item,
                  ),
                })
              }
              className="rounded border border-subtle bg-canvas px-2 py-1 font-mono text-sm"
            />
          </Field>
        ))}
      </section>

      <section aria-labelledby="ht-uses" className="flex flex-col gap-2">
        <h3 id="ht-uses" className="text-sm font-semibold">
          Used on {uses.length} {uses.length === 1 ? 'key' : 'keys'}
        </h3>
        {uses.length ? (
          <ul className="flex flex-col gap-1 text-xs text-secondary">
            {uses.map((site) => (
              <li key={`${site.layer}:${site.key}`}>
                {site.layer} · key {site.key}: <span className="font-mono">{site.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <ApplyBar
        dirty={dirty}
        problems={problems}
        error={error}
        onApply={apply}
        onRevert={() => {
          setForm(original)
          setPositionText(original.holdTriggerKeyPositions.join(' '))
          setError(null)
        }}
      />
    </div>
  )
}
