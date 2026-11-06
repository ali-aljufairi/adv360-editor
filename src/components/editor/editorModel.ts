import { describeBinding } from '../../lib/legend/describe'
import type { DescribeContext } from '../../lib/legend/describe'
import type { Binding, Issue, Layer, Model } from '../../lib/zmk/types'
import type { LayerAccess, LayerTab } from '../board/LayerTabs'
import type { PickerHoldTap, PickerLayer, PickerMacro } from '../picker/items'

/**
 * Turns a ZMK layer node name into the label shown in tabs and pickers: the `_layer` suffix is
 * dropped and words are title-cased, so `default_layer` becomes "Default".
 * @param name - The layer node name.
 * @returns The display name.
 */
export function layerDisplayName(name: string): string {
  return name
    .replace(/_layer$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/**
 * The name a layer is shown with: its `display-name` when the keymap sets one, otherwise a
 * prettified node name.
 * @param layer - The layer.
 * @returns The display name.
 */
export function layerLabelOf(layer: Pick<Layer, 'name' | 'displayName'>): string {
  const label = layer.displayName?.trim().replace(/\\(["\\])/g, '$1')
  return label || layerDisplayName(layer.name)
}

const LAYER_BEHAVIORS: Record<string, LayerAccess['kind']> = {
  mo: 'hold',
  lt: 'hold',
  tog: 'toggle',
  to: 'switch',
  sl: 'once',
}

/** The layer a binding activates and how, or null when it activates none. */
function accessOf(
  binding: Binding,
  holdTapLayers: Set<string>,
): { kind: LayerAccess['kind']; target: number } | null {
  const name = binding.behavior.replace(/^&/, '')
  const first = binding.params[0] ?? ''
  if (!/^\d+$/.test(first)) return null
  if (LAYER_BEHAVIORS[name]) return { kind: LAYER_BEHAVIORS[name], target: Number(first) }
  if (holdTapLayers.has(name)) return { kind: 'hold-tap', target: Number(first) }
  return null
}

/**
 * Every way each layer can be activated: layer keys (`&mo`, `&lt`, `&tog`, `&to`, `&sl`), user
 * hold-taps whose hold is a layer behavior, combos and conditional layers.
 * @param model - The resolved keymap.
 * @returns One list per layer, in keymap order.
 */
export function layerAccessOf(model: Model): LayerAccess[][] {
  const result: LayerAccess[][] = model.layers.map(() => [])
  const holdTapLayers = new Set(
    model.behaviors
      .filter((behavior) => behavior.compatible === 'zmk,behavior-hold-tap')
      .filter((behavior) => /^&?(mo|to|tog|sl)$/.test(behavior.bindings[0]?.text ?? ''))
      .flatMap((behavior) => [behavior.name, behavior.label ?? behavior.name]),
  )
  model.layers.forEach((layer, fromLayer) => {
    layer.bindings.forEach((binding, key) => {
      const access = accessOf(binding, holdTapLayers)
      if (!access || access.target === fromLayer || !result[access.target]) return
      result[access.target].push({ kind: access.kind, fromLayer, key, text: binding.text })
    })
  })
  for (const combo of model.combos) {
    const binding = combo.bindings[0]
    const access = binding ? accessOf(binding, holdTapLayers) : null
    if (!access || !result[access.target]) continue
    result[access.target].push({
      kind: 'combo',
      fromLayer: combo.layers?.length === 1 ? combo.layers[0] : null,
      key: null,
      positions: combo.keyPositions,
      text: binding.text,
    })
  }
  for (const rule of model.conditionalLayers) {
    if (rule.thenLayer === undefined || !result[rule.thenLayer]) continue
    result[rule.thenLayer].push({
      kind: 'conditional',
      fromLayer: null,
      key: null,
      text: `if ${rule.ifLayers.join(' + ')} then ${rule.thenLayer}`,
    })
  }
  return result
}

const VERBS: Record<LayerAccess['kind'], string> = {
  hold: 'hold',
  'hold-tap': 'hold',
  toggle: 'toggle',
  switch: 'switch',
  once: 'one-shot',
  combo: 'combo',
  conditional: 'auto',
}

/**
 * One line saying how to reach a layer, e.g. "Hold the Keypad key" or "In Macro, toggle with W".
 * @param model - The resolved keymap.
 * @param index - The layer.
 * @param access - The layer's activators from layerAccessOf.
 * @returns The summary.
 */
export function accessSummaryOf(model: Model, index: number, access: LayerAccess[]): string {
  if (index === 0) return 'Default layer: always active underneath the others'
  const first = access[0]
  if (!first) return 'No key reaches this layer'
  const names = model.layers.map(layerLabelOf)
  const context = legendContextOf(model)
  const keyName = (key: number) => {
    const base = model.layers[0]?.bindings[key]
    const legend = base ? describeBinding(base, context).primary : ''
    return legend || `key ${key}`
  }
  const verb = VERBS[first.kind]
  const capital = verb.charAt(0).toUpperCase() + verb.slice(1)
  let text: string
  if (first.kind === 'combo') text = `Combo: press keys ${first.positions?.join(' + ')} together`
  else if (first.kind === 'conditional') text = 'Turns on automatically with other layers'
  else if (first.fromLayer === 0 && first.key !== null)
    text = `${capital} the ${keyName(first.key)} key`
  else if (first.fromLayer !== null && first.key !== null)
    text = `In ${names[first.fromLayer]}, ${verb} with ${keyName(first.key)}`
  else text = capital
  return access.length > 1 ? `${text} (+${access.length - 1} more)` : text
}

/**
 * Finds the layer an issue points at: the issue's own layer when it has one, otherwise the layer
 * whose source span starts where the issue does.
 * @param model - The resolved keymap.
 * @param issue - A validator issue.
 * @returns The layer index, or -1 when none matches.
 */
export function layerOfIssue(model: Model, issue: Issue): number {
  if (issue.layer !== undefined) return issue.layer
  return model.layers.findIndex((layer) => layer.file === issue.file && layer.start === issue.start)
}

/**
 * Builds the layer tabs, marking every layer the validator cannot reach from the default layer.
 * @param model - The resolved keymap.
 * @param issues - Validator issues for the model.
 * @returns One tab per layer, in keymap order.
 */
export function layerTabsOf(model: Model, issues: Issue[]): LayerTab[] {
  const unreachable = new Set<number>()
  for (const issue of issues) {
    if (issue.code !== 'unreachable-layer') continue
    const index = layerOfIssue(model, issue)
    if (index >= 0) unreachable.add(index)
  }
  const access = layerAccessOf(model)
  return model.layers.map((layer, index) => ({
    index,
    name: layerLabelOf(layer),
    unreachable: unreachable.has(index),
    access: access[index],
    summary: accessSummaryOf(model, index, access[index]),
  }))
}

/**
 * Layer names and macro labels, used to describe bindings on keycaps.
 * @param model - The resolved keymap.
 * @returns The legend context for the board.
 */
export function legendContextOf(model: Model): DescribeContext {
  return {
    layerNames: model.layers.map(layerLabelOf),
    macros: Object.fromEntries(
      model.macros.map((macro) => [macro.name, macro.label ?? macro.name]),
    ),
  }
}

/**
 * The layers, macros and hold-taps the binding picker offers, taken from the keymap.
 * @param model - The resolved keymap.
 * @returns Picker inputs.
 */
export function pickerInputsOf(model: Model): {
  layers: PickerLayer[]
  macros: PickerMacro[]
  holdTaps: PickerHoldTap[]
} {
  return {
    layers: model.layers.map((layer, index) => ({
      index,
      name: layerLabelOf(layer),
    })),
    macros: model.macros.map((macro) => ({ label: macro.label ?? macro.name, name: macro.name })),
    holdTaps: model.behaviors
      .filter((behavior) => behavior.compatible === 'zmk,behavior-hold-tap')
      .map((behavior) => ({ label: behavior.label ?? behavior.name })),
  }
}
