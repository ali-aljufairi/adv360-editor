import type { DescribeContext } from '../../lib/legend/describe'
import type { Issue, Model } from '../../lib/zmk/types'
import type { LayerTab } from '../board/LayerTabs'
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
  return model.layers.map((layer, index) => ({
    index,
    name: layerDisplayName(layer.name),
    unreachable: unreachable.has(index),
  }))
}

/**
 * Layer names and macro labels, used to describe bindings on keycaps.
 * @param model - The resolved keymap.
 * @returns The legend context for the board.
 */
export function legendContextOf(model: Model): DescribeContext {
  return {
    layerNames: model.layers.map((layer) => layerDisplayName(layer.name)),
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
      name: layerDisplayName(layer.name),
    })),
    macros: model.macros.map((macro) => ({ label: macro.label ?? macro.name, name: macro.name })),
    holdTaps: model.behaviors
      .filter((behavior) => behavior.compatible === 'zmk,behavior-hold-tap')
      .map((behavior) => ({ label: behavior.label ?? behavior.name })),
  }
}
