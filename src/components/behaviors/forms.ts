import type {
  Behavior,
  Binding,
  BindingInput,
  Combo,
  ComboInput,
  HoldTapInput,
  MacroInput,
  Model,
  Property,
  Node,
} from '../../lib/zmk'

/** Field-level messages keyed by form field name. */
export type Problems = Record<string, string>

/** One flavor choice with a plain-English explanation. */
export interface Flavor {
  value: string
  label: string
  help: string
}

/** Hold-tap flavors in ZMK terms, with the editor's plain-English summaries. */
export const FLAVORS: Flavor[] = [
  {
    value: 'balanced',
    label: 'Balanced',
    help: 'Becomes a hold when the tapping term expires, or another key is pressed and released while this one is held.',
  },
  {
    value: 'tap-preferred',
    label: 'Tap preferred',
    help: 'Becomes a hold when the tapping term expires; other key presses do not affect the decision.',
  },
  {
    value: 'hold-preferred',
    label: 'Hold preferred',
    help: 'Becomes a hold when the tapping term expires or another key is pressed.',
  },
  {
    value: 'tap-unless-interrupted',
    label: 'Tap unless interrupted',
    help: 'Becomes a hold only if another key is pressed before the tapping term expires; otherwise it taps.',
  },
]

/** Numbers in a DTS cell list such as `<1 2 3>`. */
export function cellNumbers(raw: string | undefined): number[] {
  return (raw?.match(/-?\d+/g) ?? []).map(Number)
}

/** Text of a DTS string property without its quotes. */
export function stringValue(raw: string | undefined): string | undefined {
  const quoted = raw?.trim().match(/^"(.*)"$/)
  return quoted ? quoted[1] : raw?.trim() || undefined
}

/** True when every opening parenthesis has a matching closing one. */
export function balanced(text: string): boolean {
  let depth = 0
  for (const char of text) {
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth < 0) return false
    }
  }
  return depth === 0
}

/** The keys whose values differ between two forms. Unchanged fields are not rewritten. */
export function changedOnly<T extends object>(before: T, after: T): Partial<T> {
  const changes: Partial<T> = {}
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = after[key]
  }
  return changes
}

/** Move one item to another index, returning a new array. Out-of-range moves are no-ops. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Toggle a key position in a set, keeping the result sorted and unique. */
export function toggleIndex(positions: readonly number[], index: number): number[] {
  const next = positions.includes(index)
    ? positions.filter((item) => item !== index)
    : [...positions, index]
  return next.sort((first, second) => first - second)
}

const isInteger = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max

/** Properties of a node by name, read from its children. */
export function propertyValue(node: Node, name: string): string | undefined {
  const found = node.children.find(
    (child): child is Property => child.kind === 'property' && child.name === name,
  )
  return found?.value
}

/** A key or behavior text that is safe to write into a macro step. */
export function isKeyText(text: string): boolean {
  return /^[A-Za-z_]\w*(\(.*\))?$/.test(text.trim()) && balanced(text.trim())
}

/** A binding such as `&kp A` or `&studio_unlock`, which must start with a behavior reference. */
export function isBindingText(text: string): boolean {
  const trimmed = text.trim()
  return /^&[A-Za-z_][\w-]*(\s.*)?$/.test(trimmed) && balanced(trimmed)
}

// ---------------------------------------------------------------------------
// Hold-taps
// ---------------------------------------------------------------------------

/** Editable hold-tap fields in the form's own shape. */
export interface HoldTapForm {
  flavor: string
  tappingTermMs?: number
  quickTapMs?: number
  requirePriorIdleMs?: number
  holdTriggerKeyPositions: number[]
  holdTriggerOnRelease: boolean
  retroTap: boolean
  bindings: string[]
}

/** Read the form values from a resolved hold-tap behavior. */
export function holdTapFormOf(behavior: Behavior): HoldTapForm {
  const props = behavior.properties
  return {
    flavor: stringValue(props.flavor) ?? 'hold-preferred',
    tappingTermMs: cellNumbers(props['tapping-term-ms'])[0],
    quickTapMs: cellNumbers(props['quick-tap-ms'])[0],
    requirePriorIdleMs: cellNumbers(props['require-prior-idle-ms'])[0],
    holdTriggerKeyPositions: cellNumbers(props['hold-trigger-key-positions']),
    holdTriggerOnRelease: props['hold-trigger-on-release'] !== undefined,
    retroTap: props['retro-tap'] !== undefined,
    bindings: behavior.bindings.map((binding) => binding.text),
  }
}

/** Describe a hold-tap's timing, flavor, and usage. */
export function holdTapSummary(behavior: Behavior, usedCount: number): string {
  const form = holdTapFormOf(behavior)
  const term = form.tappingTermMs === undefined ? '—' : `${form.tappingTermMs} ms`
  return `${term} · ${form.flavor} · used on ${usedCount} ${usedCount === 1 ? 'key' : 'keys'}`
}

/** Only the hold-tap fields that changed, ready for `updateHoldTap`. */
export function holdTapChanges(before: HoldTapForm, after: HoldTapForm): HoldTapInput {
  const changes = changedOnly<HoldTapInput>(holdTapInputOf(before), holdTapInputOf(after))
  if (before.quickTapMs !== after.quickTapMs) changes.quickTapMs = after.quickTapMs ?? null
  if (before.requirePriorIdleMs !== after.requirePriorIdleMs)
    changes.requirePriorIdleMs = after.requirePriorIdleMs ?? null
  return changes
}

/** The full `HoldTapInput` for a form. */
export function holdTapInputOf(form: HoldTapForm): HoldTapInput {
  return {
    flavor: form.flavor,
    tappingTermMs: form.tappingTermMs,
    quickTapMs: form.quickTapMs,
    requirePriorIdleMs: form.requirePriorIdleMs,
    holdTriggerKeyPositions: [...form.holdTriggerKeyPositions],
    holdTriggerOnRelease: form.holdTriggerOnRelease,
    retroTap: form.retroTap,
    bindings: form.bindings,
  }
}

/** Validate a hold-tap form against the board's key count and the values it started from. */
export function holdTapProblems(
  form: HoldTapForm,
  keyCount: number,
  _before?: HoldTapForm,
): Problems {
  void _before
  const problems: Problems = {}
  if (form.tappingTermMs === undefined || !isInteger(form.tappingTermMs, 1, 2000))
    problems.tappingTermMs = 'Enter a whole number of milliseconds from 1 to 2000.'
  if (form.quickTapMs !== undefined && !isInteger(form.quickTapMs, 0, 1000))
    problems.quickTapMs = 'Enter a whole number from 0 to 1000.'
  if (form.requirePriorIdleMs !== undefined && !isInteger(form.requirePriorIdleMs, 0, 5000))
    problems.requirePriorIdleMs = 'Enter a whole number from 0 to 5000.'
  if (form.bindings.length !== 2 || form.bindings.some((binding) => !isBindingText(binding)))
    problems.bindings = 'Enter two behavior bindings starting with &.'
  if (form.holdTriggerKeyPositions.some((position) => !isInteger(position, 0, keyCount - 1)))
    problems.holdTriggerKeyPositions = `Key positions must be between 0 and ${keyCount - 1}.`
  return problems
}

/** The keys in any layer whose binding uses one of the given behavior names. */
export interface UsageSite {
  layer: string
  key: number
  text: string
}

/** Board keys bound to a hold-tap or other behavior, by its name or label. */
export function keysUsing(model: Model, names: readonly string[]): UsageSite[] {
  const sites: UsageSite[] = []
  for (const layer of model.layers) {
    layer.bindings.forEach((binding, key) => {
      if (names.includes(binding.behavior))
        sites.push({ layer: layer.displayName ?? layer.name, key, text: binding.text })
    })
  }
  return sites
}

/** Bindings that a hold-tap wraps, shown as text since the writer cannot yet emit them. */
export function wrappedBindings(behavior: Behavior): string[] {
  return behavior.bindings.map((binding: Binding) => binding.text)
}

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

/** One ordered macro step. Key steps hold a key text such as `A` or `LS(A)`. */
export type MacroStep =
  | { kind: 'tap' | 'press' | 'release'; key: string }
  | { kind: 'wait'; ms: number }
  | { kind: 'tapTime'; ms: number }
  | { kind: 'behavior'; text: string; mode?: 'tap' | 'press' | 'release' }

export const STEP_KINDS: { kind: MacroStep['kind']; label: string }[] = [
  { kind: 'tap', label: 'Tap key' },
  { kind: 'press', label: 'Press (hold) key' },
  { kind: 'release', label: 'Release key' },
  { kind: 'wait', label: 'Wait (ms)' },
  { kind: 'tapTime', label: 'Tap time (ms)' },
  { kind: 'behavior', label: 'Other behavior' },
]

export function macroOpaqueReason(macro: Behavior): string | undefined {
  const blocked = macro.bindings.find((binding) => !binding.editable)
  if (blocked) return blocked.reason ?? 'This binding is a preprocessor expression.'
  if (macro.bindings.some((binding) => binding.text.includes('MACRO_PLACEHOLDER')))
    return 'Uses MACRO_PLACEHOLDER, which is expanded by the preprocessor. Edit it in the keymap file.'
  return undefined
}

export function macroStepsOf(bindings: readonly Binding[]): MacroStep[] {
  const steps: MacroStep[] = []
  let mode: 'tap' | 'press' | 'release' = 'tap'
  for (const binding of bindings) {
    const name = binding.behavior.replace(/^&/, '')
    if (name === 'macro_tap' || name === 'macro_press' || name === 'macro_release') {
      mode = name.slice(6) as typeof mode
    } else if (
      (name === 'macro_wait_time' || name === 'macro_tap_time') &&
      /^\d+$/.test(binding.params[0] ?? '')
    ) {
      steps.push({
        kind: name === 'macro_wait_time' ? 'wait' : 'tapTime',
        ms: Number(binding.params[0]),
      })
    } else if (name === 'kp' && binding.params.length > 0) {
      steps.push({ kind: mode, key: binding.params.join(' ') })
    } else {
      steps.push({ kind: 'behavior', text: binding.text.trim(), mode })
    }
  }
  return steps
}

export function macroBindingsOf(steps: readonly MacroStep[]): BindingInput[] {
  let mode: 'tap' | 'press' | 'release' = 'tap'
  return steps.flatMap((step): BindingInput[] => {
    if (step.kind === 'wait' || step.kind === 'tapTime')
      return [
        {
          behavior: step.kind === 'wait' ? 'macro_wait_time' : 'macro_tap_time',
          params: [step.ms],
        },
      ]
    const nextMode = step.kind === 'behavior' ? (step.mode ?? 'tap') : step.kind
    const marker: BindingInput[] = nextMode === mode ? [] : [{ behavior: `macro_${nextMode}` }]
    mode = nextMode
    return [
      ...marker,
      step.kind === 'behavior' ? step.text : { behavior: 'kp', params: [step.key] },
    ]
  })
}

/** Build a step from a kind and its text (a key, a number of milliseconds, or a binding). */
export function stepFrom(kind: MacroStep['kind'], text: string): MacroStep {
  if (kind === 'wait' || kind === 'tapTime') return { kind, ms: Number(text) }
  if (kind === 'behavior') return { kind, text: text.trim() }
  return { kind, key: text.trim() }
}

/** The editable text of a step, the inverse of `stepFrom`. */
export function stepText(step: MacroStep): string {
  if (step.kind === 'wait' || step.kind === 'tapTime') return String(step.ms)
  return step.kind === 'behavior' ? step.text : step.key
}

/** The message for one step, or undefined when it is valid. */
export function stepProblem(step: MacroStep): string | undefined {
  if (step.kind === 'wait' || step.kind === 'tapTime')
    return isInteger(step.ms, 0, 10000)
      ? undefined
      : 'Wait must be a whole number from 0 to 10000 ms.'
  if (step.kind === 'behavior')
    return isBindingText(step.text) ? undefined : 'Start with & and a behavior name, such as &kp A.'
  return isKeyText(step.key) ? undefined : 'Enter a key such as A, LS(A) or ENTER.'
}

/** A one-line description of what the macro types, in order. */
export function macroPreview(steps: readonly MacroStep[], timing: MacroTiming = {}): string {
  if (!steps.length) return 'No steps yet.'
  const parts = steps.map((step) => {
    switch (step.kind) {
      case 'tap':
        return step.key
      case 'press':
        return `hold ${step.key}`
      case 'release':
        return `release ${step.key}`
      case 'wait':
        return `wait ${step.ms} ms`
      case 'tapTime':
        return `tap time ${step.ms} ms`
      case 'behavior':
        return step.text
    }
  })
  const suffix = [
    timing.tapMs !== undefined ? `tap ${timing.tapMs} ms` : '',
    timing.waitMs !== undefined ? `wait ${timing.waitMs} ms between` : '',
  ].filter(Boolean)
  return `${parts.join(' → ')}${suffix.length ? ` (${suffix.join(', ')})` : ''}`
}

/** Macro-level timing fields. */
export interface MacroTiming {
  tapMs?: number
  waitMs?: number
}

/** Macro form values: steps plus timing. */
export interface MacroForm extends MacroTiming {
  steps: MacroStep[]
}

/** Read the macro form from a resolved macro. */
export function macroFormOf(macro: Behavior): MacroForm {
  return { steps: macroStepsOf(macro.bindings), tapMs: macro.tapMs, waitMs: macro.waitMs }
}

/** Only the macro fields that changed, ready for `updateMacro`. */
export function macroChanges(before: MacroForm, after: MacroForm): Partial<MacroInput> {
  const changes: Partial<MacroInput> = {}
  if (JSON.stringify(before.steps) !== JSON.stringify(after.steps))
    changes.bindings = macroBindingsOf(after.steps)
  if (before.tapMs !== after.tapMs) changes.tapMs = after.tapMs ?? null
  if (before.waitMs !== after.waitMs) changes.waitMs = after.waitMs ?? null
  return changes
}

/** Validate timing fields and every step. */
export function macroProblems(form: MacroForm, _before?: MacroForm): Problems {
  void _before
  const problems: Problems = {}
  if (form.tapMs !== undefined && !isInteger(form.tapMs, 0, 10000))
    problems.tapMs = 'Enter a whole number from 0 to 10000 ms.'
  if (form.waitMs !== undefined && !isInteger(form.waitMs, 0, 10000))
    problems.waitMs = 'Enter a whole number from 0 to 10000 ms.'
  form.steps.forEach((step, index) => {
    const message = stepProblem(step)
    if (message) problems[`step${index}`] = message
  })
  return problems
}

// ---------------------------------------------------------------------------
// Combos
// ---------------------------------------------------------------------------

/** Editable combo fields in the form's own shape. */
export interface ComboForm {
  name: string
  binding: string
  keyPositions: number[]
  timeoutMs?: number
  allLayers: boolean
  layers: number[]
  requirePriorIdleMs?: number
  slowRelease: boolean
}

/** Read the form values from a resolved combo. */
export function comboFormOf(combo: Combo): ComboForm {
  return {
    name: combo.name,
    binding: combo.bindings.map((binding) => binding.text).join(' '),
    keyPositions: [...combo.keyPositions],
    timeoutMs: combo.timeoutMs,
    allLayers: combo.layers === undefined,
    layers: [...(combo.layers ?? [])],
    requirePriorIdleMs: cellNumbers(propertyValue(combo.node, 'require-prior-idle-ms'))[0],
    slowRelease: propertyValue(combo.node, 'slow-release') !== undefined,
  }
}

/** A blank combo for the "Add combo" flow. */
export function newComboForm(name: string): ComboForm {
  return {
    name,
    binding: '&kp A',
    keyPositions: [],
    allLayers: true,
    layers: [],
    slowRelease: false,
  }
}

/** The full `ComboInput`. "All layers" omits `layers` so the writer drops the property. */
export function comboInputOf(form: ComboForm): ComboInput {
  return {
    name: form.name,
    bindings: [form.binding.trim()],
    keyPositions: [...form.keyPositions],
    timeoutMs: form.timeoutMs,
    layers: form.allLayers ? undefined : [...form.layers],
    requirePriorIdleMs: form.requirePriorIdleMs,
    slowRelease: form.slowRelease,
  }
}

/** Only the combo fields that changed, ready for `updateCombo`. */
export function comboChanges(before: ComboForm, after: ComboForm): Partial<ComboInput> {
  const changes = changedOnly<ComboInput>(comboInputOf(before), comboInputOf(after))
  if (before.timeoutMs !== after.timeoutMs) changes.timeoutMs = after.timeoutMs ?? null
  if (before.requirePriorIdleMs !== after.requirePriorIdleMs)
    changes.requirePriorIdleMs = after.requirePriorIdleMs ?? null
  return changes
}

/** Validate a combo form. `otherNames` are the names of the other combos in the keymap. */
export function comboProblems(
  form: ComboForm,
  context: { keyCount: number; layerCount: number; otherNames: readonly string[] },
  _before?: ComboForm,
): Problems {
  void _before
  const problems: Problems = {}
  if (!/^[A-Za-z_]\w*$/.test(form.name))
    problems.name = 'Use letters, digits and underscores, starting with a letter or underscore.'
  else if (context.otherNames.includes(form.name))
    problems.name = 'Another combo already uses this name.'
  if (!isBindingText(form.binding)) problems.binding = 'Start with & and a behavior, such as &kp A.'
  const keys = form.keyPositions
  if (keys.length < 2) problems.keyPositions = 'Pick at least two keys.'
  else if (new Set(keys).size !== keys.length) problems.keyPositions = 'Each key can appear once.'
  else if (keys.some((position) => !isInteger(position, 0, context.keyCount - 1)))
    problems.keyPositions = `Key positions must be between 0 and ${context.keyCount - 1}.`
  if (form.timeoutMs !== undefined && !isInteger(form.timeoutMs, 0, 5000))
    problems.timeoutMs = 'Enter a whole number from 0 to 5000 ms.'
  if (form.requirePriorIdleMs !== undefined && !isInteger(form.requirePriorIdleMs, 0, 5000))
    problems.requirePriorIdleMs = 'Enter a whole number from 0 to 5000 ms.'
  if (!form.allLayers && form.layers.length === 0)
    problems.layers = 'Pick at least one layer, or choose All layers.'
  if (form.layers.some((layer) => !isInteger(layer, 0, context.layerCount - 1)))
    problems.layers = 'Choose layers that exist in this keymap.'
  return problems
}

/** Summary of a combo's preprocessor guard, when it has one. */
export function conditionLabel(condition: string | undefined): string | undefined {
  return condition && condition !== '1' ? `Only when ${condition}` : undefined
}
