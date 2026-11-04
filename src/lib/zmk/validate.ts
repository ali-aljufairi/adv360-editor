import type { Binding, Issue, Model, Span } from './types'
function collectIssues(
  model: Model,
  generated: Set<string>,
): { code: string; message: string; span?: Span }[] {
  const issues: { code: string; message: string; span?: Span }[] = []
  const count = model.layers.length
  const edges: number[][] = model.layers.map(() => [])
  const persistent: [number, number, Binding][] = []
  const add = (from: number, currentBinding: Binding) => {
    if (!['mo', 'lt', 'tog', 'to', 'sl'].includes(currentBinding.behavior)) return
    const target = Number(currentBinding.params[0])
    if (!Number.isInteger(target) || target < 0 || target >= count) return
    edges[from].push(target)
    if (['tog', 'to'].includes(currentBinding.behavior))
      persistent.push([from, target, currentBinding])
  }
  model.layers.forEach((currentLayer, i) => {
    if (currentLayer.bindings.length !== 76)
      issues.push({
        code: 'binding-count',
        message: `Layer ${i} has ${currentLayer.bindings.length} bindings, expected 76`,
        span: currentLayer,
      })
    currentLayer.bindings.forEach((nextBinding) => add(i, nextBinding))
  })
  for (const entry of model.combos) {
    const active = entry.layers ?? model.layers.map((_, i) => i)
    for (const pos of entry.keyPositions)
      if (pos < 0 || pos >= 76)
        issues.push({
          code: 'combo-position',
          message: `Combo ${entry.name} position ${pos} is out of range`,
          span: entry,
        })
    for (const i of active)
      if (edges[i]) entry.bindings.forEach((otherBinding) => add(i, otherBinding))
  }
  const reachable = (start: number) => {
    const seen = new Set<number>([start])
    const queue = [start]
    for (const node of queue)
      for (const value of edges[node] ?? [])
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
        message: `Layer ${i} (${nextLayer.name}) is unreachable`,
        span: nextLayer,
      })
  })
  for (const [from, to, candidateBinding] of persistent)
    if (to !== from && !reachable(to).has(from))
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
    'gresc',
    'kt',
    ...model.behaviors.map((existingBinding) => existingBinding.label ?? existingBinding.name),
    ...model.boardBehaviors,
  ])
  for (const resolvedBinding of [
    ...model.layers.flatMap((candidateLayer) => candidateLayer.bindings),
    ...model.combos.flatMap((currentEntry) => currentEntry.bindings),
    ...model.behaviors.flatMap((currentItem) => currentItem.bindings),
  ])
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
  return issues
}

/** Validate layer reachability, bindings and combos with source locations. */
export function validate(model: Model, options: { generatedBehaviors?: string[] } = {}): Issue[] {
  const issues: Issue[] = collectIssues(
    model,
    new Set(options.generatedBehaviors ?? ['macro_ver']),
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
  return issues
}
