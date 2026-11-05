import { useState } from 'react'
import type { Combo, Model, PhysicalKey } from '../../lib/zmk'
import { useEditor } from '../../lib/editor-state'
import {
  comboChanges,
  comboFormOf,
  comboInputOf,
  comboProblems,
  conditionLabel,
  newComboForm,
  toggleIndex,
  type ComboForm,
} from './forms'
import { ApplyBar, Field, KeyBoard, NumberField, messageOf } from './parts'

/** Props for the combo editor. `combo` is null when adding a new combo. */
export interface ComboEditorProps {
  combo: Combo | null
  combos: readonly Combo[]
  model: Model
  keys: readonly PhysicalKey[]
  onDone(): void
  onSaved(name: string): void
}

/** The first free name of the form `new_combo`, `new_combo_2`, and so on. */
function freeName(names: readonly string[]): string {
  let name = 'new_combo'
  for (let count = 2; names.includes(name); count++) name = `new_combo_${count}`
  return name
}

/**
 * Edit or create a combo. Applying writes one change, and deleting asks first.
 * @param props - The combo (or null to create one) and the keymap context.
 * @returns The editor.
 */
export function ComboEditor({ combo, combos, model, keys, onDone, onSaved }: ComboEditorProps) {
  const editor = useEditor()
  const [original] = useState<ComboForm>(() =>
    combo ? comboFormOf(combo) : newComboForm(freeName(combos.map((item) => item.name))),
  )
  const [form, setForm] = useState<ComboForm>(original)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const otherNames = combos.filter((item) => item !== combo).map((item) => item.name)
  const problems = comboProblems(
    form,
    { keyCount: keys.length, layerCount: model.layers.length, otherNames },
    original,
  )
  const dirty = JSON.stringify(form) !== JSON.stringify(original)
  const update = (changes: Partial<ComboForm>) =>
    setForm((previous) => ({ ...previous, ...changes }))
  const condition = conditionLabel(combo?.condition)

  const apply = () => {
    try {
      if (!combo) {
        editor.addCombo(comboInputOf(form))
        onDone()
        return
      }
      const changes = comboChanges(original, form)
      if (Object.keys(changes).length) editor.updateCombo(combo.name, changes)
      setError(null)
      onSaved(form.name)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }
  const remove = () => {
    try {
      if (combo) editor.removeCombo(combo.name)
      onDone()
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {condition ? (
        <p role="note" className="rounded-md border border-subtle p-2 text-xs text-secondary">
          {condition}. This combo stays guarded by that condition when you edit it.
        </p>
      ) : null}

      <CoreFields form={form} problems={problems} update={update} />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Keys</h3>
        <p className="text-xs text-muted">
          Press these keys together. Positions: {form.keyPositions.join(', ') || 'none yet'}.
        </p>
        <KeyBoard
          keys={keys}
          selected={form.keyPositions}
          label="Combo keys"
          onToggle={(index) => update({ keyPositions: toggleIndex(form.keyPositions, index) })}
        />
        {problems.keyPositions ? (
          <p className="text-xs text-status-error">{problems.keyPositions}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Layers</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allLayers}
            onChange={(event) =>
              update({
                allLayers: event.target.checked,
                layers: form.layers.length ? form.layers : [0],
              })
            }
          />
          All layers
        </label>
        {form.allLayers ? null : (
          <fieldset className="flex flex-wrap gap-3">
            <legend className="sr-only">Layers where this combo works</legend>
            {model.layers.map((layer, index) => (
              <label key={layer.name} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.layers.includes(index)}
                  onChange={() => update({ layers: toggleIndex(form.layers, index) })}
                />
                {layer.displayName ?? layer.name}
              </label>
            ))}
          </fieldset>
        )}
        {problems.layers ? <p className="text-xs text-status-error">{problems.layers}</p> : null}
      </section>

      {combo ? (
        <section className="flex flex-col gap-2 rounded-md border border-subtle p-3">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="mr-auto">Delete “{combo.name}”? This adds one step to Undo.</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md px-2.5 py-1 text-secondary hover:bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                className="rounded-md border border-status-error px-2.5 py-1 text-status-error hover:bg-hover"
              >
                Delete combo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="self-start rounded-md px-2.5 py-1 text-sm text-status-error hover:bg-hover"
            >
              Delete combo…
            </button>
          )}
        </section>
      ) : null}

      <ApplyBar
        dirty={dirty || !combo}
        problems={problems}
        error={error}
        onApply={apply}
        onRevert={() => {
          setForm(original)
          setError(null)
        }}
        applyLabel={combo ? 'Apply' : 'Create combo'}
      />
    </div>
  )
}

interface FieldsProps {
  form: ComboForm
  problems: Record<string, string>
  update(changes: Partial<ComboForm>): void
}

/** Name, binding, timing and the slow-release switch. */
function CoreFields({ form, problems, update }: FieldsProps) {
  return (
    <>
      <Field id="combo-name" label="Name" problem={problems.name}>
        <input
          id="combo-name"
          value={form.name}
          aria-invalid={problems.name ? true : undefined}
          onChange={(event) => update({ name: event.target.value })}
          className="rounded-md border border-subtle bg-canvas px-2 py-1 font-mono text-sm"
        />
      </Field>
      <Field
        id="combo-binding"
        label="Binding"
        help="What the combo sends, such as &kp ESC or &studio_unlock."
        problem={problems.binding}
      >
        <input
          id="combo-binding"
          value={form.binding}
          aria-invalid={problems.binding ? true : undefined}
          onChange={(event) => update({ binding: event.target.value })}
          className="rounded-md border border-subtle bg-canvas px-2 py-1 font-mono text-sm"
        />
      </Field>
      <NumberField
        id="combo-timeout"
        label="Timeout"
        unit="ms"
        min={0}
        max={5000}
        value={form.timeoutMs}
        problem={problems.timeoutMs}
        help="How long after the first key the other keys may follow."
        onChange={(value) => update({ timeoutMs: value })}
      />
      <NumberField
        id="combo-idle"
        label="Require idle before"
        unit="ms"
        min={0}
        max={5000}
        value={form.requirePriorIdleMs}
        problem={problems.requirePriorIdleMs}
        help="Only fire if no other key was pressed within this many ms."
        onChange={(value) => update({ requirePriorIdleMs: value })}
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.slowRelease}
          onChange={(event) => update({ slowRelease: event.target.checked })}
        />
        <span>
          Slow release
          <span className="block text-xs text-muted">
            Keep the binding held until every combo key is released.
          </span>
        </span>
      </label>
    </>
  )
}
