import type { Binding, Issue, Model, PhysicalKey, Span } from './types'
function collectIssues(
  model: Model,
  generated: Set<string>,
  expectedKeyCount?: number,
  expectedKeyPositions?: number[],
): { code: string; message: string; span?: Span }[] {
  const issues: { code: string; message: string; span?: Span }[] = []
  const count = model.layers.length
  const edges: number[][] = model.layers.map(() => [])
  const persistent: [number, number, Binding][] = []
  const add = (from: number, currentBinding: Binding) => {
    if (
      !currentBinding.editable ||
      !['mo', 'lt', 'tog', 'to', 'sl'].includes(currentBinding.behavior)
    )
      return
    const target = Number(currentBinding.params[0])
    if (!Number.isInteger(target) || target < 0 || target >= count) return
    edges[from].push(target)
    if (['tog', 'to'].includes(currentBinding.behavior))
      persistent.push([from, target, currentBinding])
  }
  const consistentCount = model.layers[0]?.bindings.length
  model.layers.forEach((currentLayer, i) => {
    const expected = expectedKeyCount ?? consistentCount
    if (expected !== undefined && currentLayer.bindings.length !== expected)
      issues.push({
        code: 'binding-count',
        message: `Layer ${i} has ${currentLayer.bindings.length} bindings, expected ${expected}`,
        span: currentLayer,
      })
    currentLayer.bindings.forEach((nextBinding) => add(i, nextBinding))
  })
  for (const entry of model.combos) {
    const active = entry.layers ?? model.layers.map((_, i) => i)
    for (const pos of entry.keyPositions)
      if (expectedKeyPositions && !expectedKeyPositions.includes(pos))
        issues.push({
          code: 'combo-position',
          message: `Combo ${entry.name} position ${pos} is not present in the selected layout`,
          span: entry,
        })
    for (const i of active)
      if (edges[i]) entry.bindings.forEach((otherBinding) => add(i, otherBinding))
  }
  for (const rule of model.conditionalLayers) {
    if (rule.thenLayer === undefined || rule.thenLayer < 0 || rule.thenLayer >= count) {
      issues.push({
        code: 'conditional-layer-reference',
        message: `Conditional layer ${rule.name} references missing target layer ${rule.thenLayer ?? '(none)'}`,
        span: rule,
      })
      continue
    }
    for (const from of rule.ifLayers) {
      if (from < 0 || from >= count) {
        issues.push({
          code: 'conditional-layer-reference',
          message: `Conditional layer ${rule.name} references missing source layer ${from}`,
          span: rule,
        })
      } else edges[from].push(rule.thenLayer)
    }
  }
  // A transparent key on an upper layer invokes the binding at the same position in a lower
  // active layer. Include those fall-throughs in reachability so persistent overlays can have a
  // real route back through an underlying toggle (for example layer 4 -> layer 3 via `&tog 4`).
  const fallthroughEdges: number[][] = model.layers.map(() => [])
  model.layers.forEach((upperLayer, upperIndex) => {
    upperLayer.bindings.forEach((currentBinding, position) => {
      if (currentBinding.behavior !== 'trans') return
      for (let lowerIndex = 0; lowerIndex < upperIndex; lowerIndex += 1) {
        const lowerBinding = model.layers[lowerIndex]?.bindings[position]
        if (!lowerBinding || !['mo', 'lt', 'tog', 'to', 'sl'].includes(lowerBinding.behavior))
          continue
        const target = Number(lowerBinding.params[0])
        if (Number.isInteger(target) && target >= 0 && target < count)
          fallthroughEdges[upperIndex].push(target)
        // A transparent key can reach a lower toggle that switches off this overlay.
        if (lowerBinding.behavior === 'tog' && target === upperIndex)
          fallthroughEdges[upperIndex].push(lowerIndex)
      }
    })
  })
  const reachable = (start: number, includeFallthrough = false) => {
    const seen = new Set<number>([start])
    const queue = [start]
    for (const node of queue)
      for (const value of [
        ...(edges[node] ?? []),
        ...(includeFallthrough ? (fallthroughEdges[node] ?? []) : []),
      ])
        if (!seen.has(value)) {
          seen.add(value)
          queue.push(value)
        }
    return seen
  }
  const fromZero = reachable(0)
  model.layers.forEach((nextLayer, i) => {
    if (!fromZero.has(i))
      issues.push({
        code: 'unreachable-layer',
        message:
          `${nextLayer.displayName ?? nextLayer.name} can't be reached: no key turns it on ` +
          `(ZMK layer ${i})`,
        span: nextLayer,
      })
  })
  for (const [from, to, candidateBinding] of persistent)
    if (to !== from && !reachable(to, true).has(from))
      issues.push({
        code: 'no-return',
        message: `Layer ${to} has no path back to layer ${from}`,
        span: candidateBinding,
      })
  for (let i = 0; i < model.combos.length; i++)
    for (let j = i + 1; j < model.combos.length; j++) {
      const first = model.combos[i],
        selectedBinding = model.combos[j]
      if (
        first.keyPositions.some((property) => selectedBinding.keyPositions.includes(property)) &&
        (!first.layers ||
          !selectedBinding.layers ||
          first.layers.some((otherLayer) => selectedBinding.layers!.includes(otherLayer)))
      )
        issues.push({
          code: 'combo-overlap',
          message: `Combos ${first.name} and ${selectedBinding.name} overlap`,
          span: selectedBinding,
        })
    }
  const known = new Set([
    'kp',
    'mo',
    'lt',
    'tog',
    'to',
    'sl',
    'mt',
    'trans',
    'none',
    'bt',
    'rgb_ug',
    'bl',
    'bootloader',
    'studio_unlock',
    'mkp',
    'mmv',
    'msc',
    'sk',
    'caps_word',
    'sys_reset',
    'ext_power',
    'out',
    'macro_pause_for_release',
    'macro_press',
    'macro_release',
    'macro_tap',
    'macro_wait_time',
    'macro_tap_time',
    'key_repeat',
    'soft_off',
    'key_toggle',
    'kt',
    'stp',
    'gresc',
    'macro_param_1to1',
    'macro_param_1to2',
    'macro_param_2to1',
    'macro_param_2to2',
    ...model.behaviors.map((existingBinding) => existingBinding.label ?? existingBinding.name),
    ...model.boardBehaviors,
  ])
  for (const resolvedBinding of [
    ...model.layers.flatMap((candidateLayer) => candidateLayer.bindings),
    ...model.combos.flatMap((currentEntry) => currentEntry.bindings),
    ...model.behaviors.flatMap((currentItem) => currentItem.bindings),
  ]) {
    if (!resolvedBinding.editable || /^macro_param_\d+to\d+$/.test(resolvedBinding.behavior))
      continue
    if (!known.has(resolvedBinding.behavior) && generated.has(resolvedBinding.behavior))
      issues.push({
        code: 'generated-behavior',
        message: `Behavior &${resolvedBinding.behavior} is generated at build time`,
        span: resolvedBinding,
      })
    else if (!known.has(resolvedBinding.behavior))
      issues.push({
        code: 'undefined-behavior',
        message: `Undefined behavior &${resolvedBinding.behavior}`,
        span: resolvedBinding,
      })
  }
  return issues
}

const keyLabels: Record<string, string> = {
  LEFT_ALT: 'LALT',
  RIGHT_ALT: 'RALT',
  LEFT_CTRL: 'LCTRL',
  LEFT_CONTROL: 'LCTRL',
  RIGHT_CTRL: 'RCTRL',
  RIGHT_CONTROL: 'RCTRL',
  LEFT_SHIFT: 'LSHIFT',
  RIGHT_SHIFT: 'RSHIFT',
  LEFT_GUI: 'LGUI',
  RIGHT_GUI: 'RGUI',
}
const normalizeKeyLabel = (value: string) =>
  (keyLabels[value.toUpperCase()] ?? value).toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Validate layer reachability, bindings and combos with source locations. */
export function validate(
  model: Model,
  options: {
    generatedBehaviors?: string[]
    physicalLayout?: PhysicalKey[]
    expectedKeyCount?: number
    expectedKeyPositions?: number[]
  } = {},
): Issue[] {
  const expectedKeyCount = options.expectedKeyCount ?? options.physicalLayout?.length
  const expectedKeyPositions =
    options.expectedKeyPositions ??
    options.physicalLayout?.map((key) => key.index) ??
    (expectedKeyCount === undefined
      ? undefined
      : Array.from({ length: expectedKeyCount }, (_, index) => index))
  const issues: Issue[] = collectIssues(
    model,
    new Set(options.generatedBehaviors ?? ['macro_ver']),
    expectedKeyCount,
    expectedKeyPositions,
  ).map((issue) => {
    const span = issue.span ?? { file: '', start: 0, end: 0 }
    const layer = model.layers.findIndex(
      (item) => item.file === span.file && span.start >= item.start && span.start < item.end,
    )
    const key =
      layer < 0 ? -1 : model.layers[layer].bindings.findIndex((item) => item.start === span.start)
    return {
      code: issue.code,
      severity:
        issue.code === 'undefined-behavior'
          ? 'error'
          : issue.code === 'generated-behavior'
            ? 'info'
            : 'warning',
      message: issue.message,
      file: span.file,
      start: span.start,
      end: span.end,
      ...(layer >= 0 ? { layer } : {}),
      ...(key >= 0 ? { key } : {}),
    }
  })
  for (const combo of model.combos)
    if (combo.condition)
      issues.push({
        code: 'conditional-combo',
        severity: 'info',
        message: `Combo ${combo.name} is guarded by ${combo.condition}`,
        file: combo.file,
        start: combo.start,
        end: combo.end,
      })
  if (options.physicalLayout) {
    const layout = options.physicalLayout
    for (let layer = 0; layer < model.layers.length; layer++) {
      const currentLayer = model.layers[layer]
      if (currentLayer.bindings.length !== layout.length)
        issues.push({
          code: 'info-key-count',
          severity: 'warning',
          message: `Layer ${layer} has ${currentLayer.bindings.length} bindings but selected layout has ${layout.length} keys`,
          file: currentLayer.file,
          start: currentLayer.start,
          end: currentLayer.end,
          layer,
        })
    }
    const firstLayer = model.layers[0]
    if (firstLayer) {
      for (const key of layout) {
        const binding = firstLayer.bindings[key.index]
        const keycode =
          binding?.behavior === 'kp' && binding.params.length === 1
            ? binding.params[0].trim()
            : undefined
        if (!key.label || !keycode || /[()\s]/.test(keycode)) continue
        if (normalizeKeyLabel(key.label) !== normalizeKeyLabel(keycode))
          issues.push({
            code: 'info-label-mismatch',
            severity: 'info',
            message: `info.json key ${key.index} is labeled ${key.label}, but layer 0 binds ${keycode}`,
            file: firstLayer.file,
            start: binding.start,
            end: binding.end,
            layer: 0,
            key: key.index,
          })
      }
    }
  }
  return issues
}
