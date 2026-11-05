import { resolveKeyCode, spellKey, usageOf, type PreferredNames } from './catalog'

/** A ZMK modifier wrapper: left or right Ctrl, Shift, Alt or GUI. */
export type ModId = 'LC' | 'LS' | 'LA' | 'LG' | 'RC' | 'RS' | 'RA' | 'RG'

/** A modifier family as shown on a chip, with its left and right ZMK wrappers. */
export interface ModChip {
  family: 'C' | 'A' | 'S' | 'G'
  glyph: string
  label: string
  left: ModId
  right: ModId
}

/** Modifier chips in display order. Wrapping follows this order, outermost first. */
export const MOD_CHIPS: readonly ModChip[] = [
  { family: 'C', glyph: '⌃', label: 'Control', left: 'LC', right: 'RC' },
  { family: 'A', glyph: '⌥', label: 'Option', left: 'LA', right: 'RA' },
  { family: 'S', glyph: '⇧', label: 'Shift', left: 'LS', right: 'RS' },
  { family: 'G', glyph: '⌘', label: 'Command', left: 'LG', right: 'RG' },
]

/** A chosen thing that a binding can be built from. */
export type Choice =
  | { kind: 'key'; code: string }
  | { kind: 'action'; behavior: string; params: readonly string[] }
  | { kind: 'layer'; layer: number }
  /** A platform shortcut: a key wrapped in fixed modifiers, e.g. `LG(C)` on mac. */
  | { kind: 'shortcut'; code: string; mods: readonly ModId[] }

/** A binding as a keymap holds it. Only the behavior and parameters matter here. */
export interface BindingLike {
  behavior: string
  params: readonly string[]
}

/** The editor's binding shape: a behavior and its parameters. */
export interface BindingValue {
  behavior: string
  params: string[]
}

/** Parameter order of a hold-tap: `hold-tap` is `&mt HOLD TAP`, `tap-hold` is `&x TAP HOLD`. */
export type HoldTapOrder = 'hold-tap' | 'tap-hold'

/** What a hold-tap's hold parameter takes: a key (or modifier) or a layer. */
export type HoldKind = 'key' | 'layer'

/** A hold-tap behavior the picker can write. `behavior` includes the `&`. */
export interface HoldTapSpec {
  behavior: string
  order: HoldTapOrder
  holdKind: HoldKind
}

/** A hold-tap as described by the caller. Missing fields take the hold-tap / key defaults. */
export interface HoldTapEntry {
  label: string
  order?: HoldTapOrder
  holdKind?: HoldKind
}

/** The state of the picker while the user is still choosing. */
export type Draft =
  | { mode: 'single'; choice: Choice | null; mods: readonly ModId[] }
  | {
      mode: 'hold'
      behavior: string
      tap: Choice | null
      hold: Choice | null
      mods: readonly ModId[]
      /** Set only for `tap-hold` order; absent means `hold-tap`. */
      order?: HoldTapOrder
    }

/** The picker's behavior tabs, in display order. */
export type BehaviorTab =
  'key' | 'taphold' | 'layer' | 'macro' | 'bluetooth' | 'mouse' | 'system' | 'empty'

/** Labels for the behavior tabs, in display order. */
export const BEHAVIOR_TABS: readonly { id: BehaviorTab; label: string }[] = [
  { id: 'key', label: 'Key' },
  { id: 'taphold', label: 'Tap/Hold' },
  { id: 'layer', label: 'Layer' },
  { id: 'macro', label: 'Macro' },
  { id: 'bluetooth', label: 'Bluetooth' },
  { id: 'mouse', label: 'Mouse' },
  { id: 'system', label: 'System' },
  { id: 'empty', label: 'Empty' },
]

/** A layer behavior the Layer tab can write, with the mode's button label. */
export type LayerMode = 'mo' | 'tog' | 'to' | 'sl'

/** Layer modes in display order. Each maps to one ZMK layer behavior. */
export const LAYER_MODES: readonly {
  id: LayerMode
  label: string
  behavior: string
  hint: string
}[] = [
  { id: 'mo', label: 'Hold', behavior: '&mo', hint: 'Active while the key is held' },
  { id: 'tog', label: 'Toggle', behavior: '&tog', hint: 'Press once on, again off' },
  { id: 'to', label: 'Switch', behavior: '&to', hint: 'Go to this layer and stay there' },
  { id: 'sl', label: 'Once', behavior: '&sl', hint: 'Active for the next key press only' },
]

/** The hold-tap behaviors every keymap can use; the picker always offers them. */
export const DEFAULT_HOLD_TAPS: readonly HoldTapSpec[] = [
  { behavior: '&mt', order: 'hold-tap', holdKind: 'key' },
  { behavior: '&lt', order: 'hold-tap', holdKind: 'layer' },
]

/**
 * Builds the hold-tap specs the picker uses: the built-in `&mt` and `&lt`, then the keymap's
 * hold-taps. A later entry with the same behavior replaces an earlier one.
 * @param entries - Hold-taps from the model, by label without `&`.
 * @returns Specs in order: built-ins first, then custom behaviors.
 */
export function holdTapSpecs(entries: readonly HoldTapEntry[] = []): HoldTapSpec[] {
  const specs = new Map(DEFAULT_HOLD_TAPS.map((spec) => [spec.behavior, spec]))
  for (const entry of entries) {
    const behavior = `&${entry.label}`
    specs.set(behavior, {
      behavior,
      order: entry.order ?? 'hold-tap',
      holdKind: entry.holdKind ?? 'key',
    })
  }
  return [...specs.values()]
}

/** What `kindOfBinding` needs to know beyond the binding itself. */
export interface PickerContext {
  holdTaps?: readonly HoldTapSpec[]
  /** Macro behaviors, with their `&`, e.g. `&hello_world`. */
  macros?: readonly string[]
}

const KEY_BEHAVIORS = new Set(['&kp', '&sk', '&kt', '&caps_word', '&gresc', '&key_repeat'])
const BLUETOOTH_BEHAVIORS = new Set(['&bt', '&out'])
const MOUSE_BEHAVIORS = new Set(['&mkp', '&mmv', '&msc'])
const EMPTY_BEHAVIORS = new Set(['&trans', '&none'])

/**
 * Picks the behavior tab a binding belongs to, so the picker can open on it.
 * Anything without a dedicated tab (bootloader, lighting, power, ...) is System.
 * @param value - The binding.
 * @param context - Custom hold-taps and macros in the keymap.
 * @returns The tab that shows this binding.
 */
export function kindOfBinding(value: BindingValue, context: PickerContext = {}): BehaviorTab {
  const { behavior, params } = value
  const holdTaps = [...DEFAULT_HOLD_TAPS, ...(context.holdTaps ?? [])]
  if (params.length === 2 && holdTaps.some((spec) => spec.behavior === behavior)) return 'taphold'
  if (LAYER_BEHAVIORS.has(behavior)) return 'layer'
  if (behavior.startsWith('&macro_') || (context.macros ?? []).includes(behavior)) return 'macro'
  if (KEY_BEHAVIORS.has(behavior)) return 'key'
  if (BLUETOOTH_BEHAVIORS.has(behavior)) return 'bluetooth'
  if (MOUSE_BEHAVIORS.has(behavior)) return 'mouse'
  if (EMPTY_BEHAVIORS.has(behavior)) return 'empty'
  return 'system'
}

/**
 * Builds a layer binding for one of the four layer behaviors.
 * @param mode - Hold, Toggle, Switch or Once.
 * @param layer - Layer index.
 * @returns The binding, e.g. `&tog 2`.
 */
export function layerBinding(mode: LayerMode, layer: number): BindingValue {
  const entry = LAYER_MODES.find((candidate) => candidate.id === mode)
  return { behavior: entry?.behavior ?? '&mo', params: [String(layer)] }
}

/**
 * Reads the layer mode and index from a layer binding.
 * @param value - The binding.
 * @returns The mode and layer, or null when the binding is not a layer behavior.
 */
export function layerModeOf(value: BindingValue): { mode: LayerMode; layer: number } | null {
  const entry = LAYER_MODES.find((candidate) => candidate.behavior === value.behavior)
  if (!entry || value.params.length !== 1 || !NUMBER_PATTERN.test(value.params[0])) return null
  return { mode: entry.id, layer: Number(value.params[0]) }
}

/**
 * Looks up what a hold-tap behavior holds: a key or a layer.
 * @param behavior - Behavior with its `&`.
 * @param specs - Known hold-tap specs.
 * @returns The hold kind, defaulting to a key for unknown behaviors.
 */
export function holdKindOf(behavior: string, specs: readonly HoldTapSpec[]): HoldKind {
  return specs.find((spec) => spec.behavior === behavior)?.holdKind ?? 'key'
}

const MOD_PATTERN = /^(LC|LS|LA|LG|RC|RS|RA|RG)\((.*)\)$/i
const BEHAVIOR_PATTERN = /^&[A-Za-z_][A-Za-z0-9_]*$/
const NUMBER_PATTERN = /^\d+$/
const NO_PARAM_BEHAVIORS = new Set(['&trans', '&none', '&bootloader', '&sys_reset'])
const LAYER_BEHAVIORS = new Set(['&mo', '&tog', '&to', '&sl'])

/**
 * Wraps a key in modifier wrappers. The first modifier becomes the outermost wrapper.
 * @param code - Key code, e.g. `A`.
 * @param mods - Modifiers in display order, e.g. `['LC', 'LS']`.
 * @returns The wrapped code, e.g. `LC(LS(A))`.
 */
export function wrapMods(code: string, mods: readonly ModId[]): string {
  let wrapped = code
  for (let index = mods.length - 1; index >= 0; index -= 1) {
    wrapped = `${mods[index]}(${wrapped})`
  }
  return wrapped
}

/**
 * Splits a wrapped key such as `LC(LS(K))` into its modifiers and bare key.
 * @param param - A key parameter as written in a keymap.
 * @returns The bare key and the modifiers from outermost to innermost.
 */
export function unwrapMods(param: string): { code: string; mods: ModId[] } {
  const match = MOD_PATTERN.exec(param.trim())
  if (!match) return { code: param.trim(), mods: [] }
  const inner = unwrapMods(match[2])
  return { code: inner.code, mods: [match[1].toUpperCase() as ModId, ...inner.mods] }
}

/**
 * Tells whether a key parameter resolves to a known key, allowing any number of modifier
 * wrappers around it.
 * @param param - Key parameter, e.g. `LC(LS(K))` or `LSHFT`.
 * @returns True when the key is known to the catalog.
 */
export function isValidKeyParam(param: string): boolean {
  const unwrapped = unwrapMods(param)
  return unwrapped.code.length > 0 && resolveKeyCode(unwrapped.code) !== undefined
}

/**
 * Builds the binding for a single choice. Modifiers apply to key choices; a shortcut keeps its
 * own fixed modifiers and ignores the chips.
 * @param choice - What the user picked.
 * @param mods - Modifiers to wrap a key with.
 * @param names - The user's spellings, so a key is written the way their keymap writes it.
 * @returns The behavior and parameters to write.
 */
export function choiceToBinding(
  choice: Choice,
  mods: readonly ModId[] = [],
  names: PreferredNames = {},
): BindingValue {
  if (choice.kind === 'key') {
    return { behavior: '&kp', params: [wrapMods(spellKey(choice.code, names), mods)] }
  }
  if (choice.kind === 'shortcut') {
    return { behavior: '&kp', params: [wrapMods(spellKey(choice.code, names), choice.mods)] }
  }
  if (choice.kind === 'layer') {
    return { behavior: '&mo', params: [String(choice.layer)] }
  }
  return { behavior: choice.behavior, params: [...choice.params] }
}

/**
 * Builds a complete binding from a draft.
 * @param draft - The picker state.
 * @param names - The user's spellings, from `collectPreferredNames`.
 * @returns The binding, or null while the draft is still incomplete or invalid.
 */
export function buildBinding(draft: Draft, names: PreferredNames = {}): BindingValue | null {
  if (draft.mode === 'single') {
    return draft.choice ? choiceToBinding(draft.choice, draft.mods, names) : null
  }
  if (!draft.tap || !draft.hold) return null
  if (draft.tap.kind !== 'key') return null
  const holdParam = holdParamOf(draft.hold, names)
  if (holdParam === null) return null
  const tapParam = wrapMods(spellKey(draft.tap.code, names), draft.mods)
  return {
    behavior: draft.behavior,
    params: draft.order === 'tap-hold' ? [tapParam, holdParam] : [holdParam, tapParam],
  }
}

/**
 * The parameter a hold slot writes, or null when the choice cannot be held.
 * @param hold - The hold-slot choice.
 * @param names - The user's spellings.
 * @returns The parameter string, or null.
 */
function holdParamOf(hold: Choice, names: PreferredNames): string | null {
  if (hold.kind === 'key') return spellKey(hold.code, names)
  if (hold.kind === 'layer') return String(hold.layer)
  return null
}

/**
 * Finds the spelling each key already has in a keymap. For every key the keymap uses, the most
 * frequent spelling wins (the first one seen breaks ties), so `&kp LSHFT` in a keymap makes
 * Left Shift be written as `LSHFT` by the picker.
 * @param bindings - Every binding in the keymap.
 * @returns Usage id to spelling, ready to pass as `preferredNames`.
 */
export function collectPreferredNames(bindings: readonly BindingLike[]): PreferredNames {
  const counts = new Map<number, Map<string, number>>()
  for (const binding of bindings) {
    for (const param of binding.params) {
      const spelling = unwrapMods(param).code.toUpperCase()
      const usage = usageOf(spelling)
      if (usage === undefined) continue
      const spellings = counts.get(usage) ?? new Map<string, number>()
      spellings.set(spelling, (spellings.get(spelling) ?? 0) + 1)
      counts.set(usage, spellings)
    }
  }
  const preferred: Record<string, string> = {}
  for (const [usage, spellings] of counts) {
    let best = ''
    let bestCount = 0
    for (const [spelling, count] of spellings) {
      if (count > bestCount) {
        best = spelling
        bestCount = count
      }
    }
    preferred[String(usage)] = best
  }
  return preferred
}

/**
 * Formats a binding as keymap text, e.g. `&kp LC(C)`.
 * @param value - The behavior and parameters.
 * @returns The keymap text for the binding.
 */
export function formatBinding(value: BindingValue): string {
  return `${value.behavior} ${value.params.join(' ')}`.trimEnd()
}

/**
 * Reads an existing binding back into a draft so the picker can show it.
 * @param value - The binding being edited.
 * @param specs - Hold-taps in the keymap; `&mt` and `&lt` are always known.
 * @returns A draft that reproduces the binding.
 */
export function draftFromBinding(
  value: BindingValue,
  specs: readonly HoldTapSpec[] = DEFAULT_HOLD_TAPS,
): Draft {
  if (value.behavior === '&kp' && value.params.length === 1) {
    const unwrapped = unwrapMods(value.params[0])
    return {
      mode: 'single',
      choice: { kind: 'key', code: unwrapped.code },
      mods: unwrapped.mods,
    }
  }
  const spec = [...DEFAULT_HOLD_TAPS, ...specs].find((entry) => entry.behavior === value.behavior)
  if (spec && value.params.length === 2) {
    const tapIndex = spec.order === 'tap-hold' ? 0 : 1
    const tap = unwrapMods(value.params[tapIndex])
    const holdParam = value.params[1 - tapIndex]
    const hold: Choice =
      spec.holdKind === 'layer'
        ? { kind: 'layer', layer: Number(holdParam) }
        : { kind: 'key', code: holdParam }
    return {
      mode: 'hold',
      behavior: value.behavior,
      tap: { kind: 'key', code: tap.code },
      hold,
      mods: tap.mods,
      ...(spec.order === 'tap-hold' ? { order: 'tap-hold' as const } : {}),
    }
  }
  return {
    mode: 'single',
    choice: { kind: 'action', behavior: value.behavior, params: value.params },
    mods: [],
  }
}

/** The result of parsing keymap text. */
export type ParseResult =
  { ok: true; value: BindingValue; warning?: string } | { ok: false; error: string }

function isRawKeyParam(param: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(unwrapMods(param).code)
}

/**
 * Validates one binding's parameters against its behavior.
 * @param behavior - Behavior name, including the `&`.
 * @param params - Parameters following the behavior.
 * @returns An error message, or null when the parameters are acceptable.
 */
function checkParams(
  behavior: string,
  params: readonly string[],
  customKeys: ReadonlySet<string>,
): string | null {
  const knownKey = (param: string) =>
    isValidKeyParam(param) || customKeys.has(unwrapMods(param).code.toUpperCase())
  if (behavior === '&kp') {
    if (params.length !== 1) return '&kp takes exactly one key'
    return knownKey(params[0]) || isRawKeyParam(params[0]) ? null : `Unknown key "${params[0]}"`
  }
  if (behavior === '&mt' || behavior === '&lt') {
    if (params.length !== 2) return `${behavior} takes a hold and a tap`
    if (behavior === '&lt' && !NUMBER_PATTERN.test(params[0])) return 'Layer must be a number'
    if (behavior === '&mt' && !knownKey(params[0]) && !isRawKeyParam(params[0])) {
      return `Unknown key "${params[0]}"`
    }
    return knownKey(params[1]) || isRawKeyParam(params[1]) ? null : `Unknown key "${params[1]}"`
  }
  if (LAYER_BEHAVIORS.has(behavior)) {
    if (params.length !== 1 || !NUMBER_PATTERN.test(params[0])) return 'Layer must be a number'
    return null
  }
  if (NO_PARAM_BEHAVIORS.has(behavior)) {
    return params.length === 0 ? null : `${behavior} takes no parameters`
  }
  return params.every((param) => /^[A-Za-z0-9_()]+$/.test(param))
    ? null
    : 'Parameters may only contain letters, digits, _ and ()'
}

/**
 * Parses and validates keymap text such as `&mt LSHIFT A`.
 * Unknown behaviors are accepted (macros and board-specific behaviors are not in the catalog);
 * known behaviors are checked parameter by parameter.
 * @param text - The binding as the user typed it.
 * @returns The parsed binding, or an error message for the advanced field.
 */
export function parseBindingText(
  text: string,
  customKeyNames: readonly string[] = [],
): ParseResult {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
  if (tokens.length === 0) return { ok: false, error: 'Enter a binding such as &kp A' }
  const [behavior, ...params] = tokens
  if (!BEHAVIOR_PATTERN.test(behavior)) {
    return { ok: false, error: 'A binding starts with a behavior such as &kp' }
  }
  const customKeys = new Set(customKeyNames.map((name) => name.toUpperCase()))
  const error = checkParams(behavior, params, customKeys)
  if (error) return { ok: false, error }
  const unknownKey =
    (behavior === '&kp' &&
      !isValidKeyParam(params[0]) &&
      !customKeys.has(unwrapMods(params[0]).code.toUpperCase())) ||
    ((behavior === '&mt' || behavior === '&lt') &&
      params.some(
        (param) =>
          !NUMBER_PATTERN.test(param) &&
          !isValidKeyParam(param) &&
          !customKeys.has(unwrapMods(param).code.toUpperCase()),
      ))
  return {
    ok: true,
    value: { behavior, params },
    ...(unknownKey
      ? {
          warning:
            'Unlisted key name kept as raw text; verify it is defined by an included header.',
        }
      : {}),
  }
}
