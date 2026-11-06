import type { ReactNode } from 'react'
import type { PhysicalKey } from '../../lib/zmk'

/** Props for a labelled form field. */
export interface FieldProps {
  id: string
  label: string
  help?: string
  problem?: string
  children: ReactNode
}

/**
 * A labelled field with optional help text and a validation message.
 * @param props - Label, help, problem and the control.
 * @returns The field.
 */
export function Field({ id, label, help, problem, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-primary">
        {label}
      </label>
      {children}
      {help ? <p className="text-xs text-muted">{help}</p> : null}
      {problem ? (
        <p className="text-xs text-status-error" id={`${id}-problem`}>
          {problem}
        </p>
      ) : null}
    </div>
  )
}

/** Props for a number field, optionally paired with a slider. */
export interface NumberFieldProps {
  id: string
  label: string
  value: number | undefined
  min: number
  max: number
  unit: string
  help?: string
  problem?: string
  slider?: boolean
  onChange(value: number | undefined): void
}

/**
 * A whole-number field, optionally with a slider that moves in step with it.
 * @param props - Field identity, bounds, value and change handler.
 * @returns The field.
 */
export function NumberField({
  id,
  label,
  value,
  min,
  max,
  unit,
  help,
  problem,
  slider,
  onChange,
}: NumberFieldProps) {
  const parse = (raw: string) => (raw === '' ? undefined : Number(raw))
  return (
    <Field id={id} label={label} help={help} problem={problem}>
      <div className="flex items-center gap-3">
        {slider ? (
          <input
            type="range"
            aria-label={`${label} slider`}
            min={min}
            max={max}
            value={value ?? min}
            onChange={(event) => onChange(parse(event.target.value))}
            className="flex-1 accent-[var(--accent-primary)]"
          />
        ) : null}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value ?? ''}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => onChange(parse(event.target.value))}
          className="w-24 rounded-md border border-subtle bg-canvas px-2 py-1 text-sm"
        />
        <span className="text-xs text-muted">{unit}</span>
      </div>
    </Field>
  )
}

/** Props for the apply bar at the foot of an editor. */
export interface ApplyBarProps {
  dirty: boolean
  problems: Record<string, string>
  error: string | null
  onApply(): void
  onRevert(): void
  applyLabel?: string
}

/**
 * Apply and revert controls. Applying writes one change to the keymap, so it adds one Undo step.
 * @param props - Dirty state, validation, error and handlers.
 * @returns The bar.
 */
export function ApplyBar({
  dirty,
  problems,
  error,
  onApply,
  onRevert,
  applyLabel = 'Apply',
}: ApplyBarProps) {
  const blocked = Object.keys(problems).length > 0
  const status = error
    ? error
    : !dirty
      ? 'No unsaved changes.'
      : blocked
        ? 'Fix the highlighted fields to apply.'
        : 'Applying adds one step to Undo.'
  return (
    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-subtle bg-raised px-4 py-3">
      <p role="status" className={`mr-auto text-xs ${error ? 'text-status-error' : 'text-muted'}`}>
        {status}
      </p>
      <button
        type="button"
        onClick={onRevert}
        disabled={!dirty}
        className="rounded-md px-2.5 py-1 text-sm text-secondary hover:bg-hover disabled:opacity-40"
      >
        Revert
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={!dirty || blocked}
        className="rounded-md border border-subtle bg-hover px-3 py-1 text-sm font-medium disabled:opacity-40"
      >
        {applyLabel}
      </button>
    </div>
  )
}

/** Props for the board view used to pick key positions. */
export interface KeyBoardProps {
  keys: readonly PhysicalKey[]
  selected: readonly number[]
  label: string
  onToggle?(index: number): void
}

/**
 * A small board view. Keys show their position numbers, and selected keys are filled.
 * Rotated keys are drawn unrotated, which is good enough for picking positions.
 * @param props - Key geometry, selection and an optional toggle handler.
 * @returns The SVG board.
 */
export function KeyBoard({ keys, selected, label, onToggle }: KeyBoardProps) {
  if (!keys.length) return <p className="text-sm text-muted">No key layout is loaded.</p>
  const left = Math.min(...keys.map((key) => key.x))
  const top = Math.min(...keys.map((key) => key.y))
  const right = Math.max(...keys.map((key) => key.x + key.w))
  const bottom = Math.max(...keys.map((key) => key.y + key.h))
  return (
    <svg
      role="group"
      aria-label={label}
      viewBox={`${left - 0.1} ${top - 0.1} ${right - left + 0.2} ${bottom - top + 0.2}`}
      className="w-full max-w-xl"
    >
      {keys.map((key) => {
        const on = selected.includes(key.index)
        const toggle = () => onToggle?.(key.index)
        return (
          <g
            key={key.index}
            role={onToggle ? 'button' : 'img'}
            aria-pressed={onToggle ? on : undefined}
            aria-label={`Key ${key.index}${on ? ', selected' : ''}`}
            tabIndex={onToggle ? 0 : undefined}
            onClick={onToggle ? toggle : undefined}
            onKeyDown={(event) => {
              if (onToggle && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                toggle()
              }
            }}
            className={
              onToggle ? 'cursor-pointer outline-none focus-visible:opacity-80' : undefined
            }
          >
            <rect
              x={key.x + 0.06}
              y={key.y + 0.06}
              width={key.w - 0.12}
              height={key.h - 0.12}
              rx={0.14}
              strokeWidth={0.04}
              className={
                on ? 'fill-accent-primary stroke-accent-primary' : 'fill-raised stroke-subtle'
              }
            />
            <text
              x={key.x + key.w / 2}
              y={key.y + key.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.32}
              className={on ? 'fill-on-accent' : 'fill-secondary'}
            >
              {key.index}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The text of an error, whatever was thrown.
 * @param error - The thrown value.
 * @returns A readable message.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The change could not be applied.'
}
