import type { Binding, Issue, Model, Span } from './types'
function collectIssues(
  model: Model,
  generated: Set<string>,
): { code: string; message: string; span?: Span }[] {
  const issues: { code: string; message: string; span?: Span }[] = []
  const count = model.layers.length
  const edges: number[][] = model.layers.map(() => [])
  const persistent: [number, number, Binding][] = []
  const add = (from: number, b: Binding) => {
    if (!['mo', 'lt', 'tog', 'to', 'sl'].includes(b.behavior)) return
    const target = Number(b.params[0])
    if (!Number.isInteger(target) || target < 0 || target >= count) return
    edges[from].push(target)
    if (['tog', 'to'].includes(b.behavior)) persistent.push([from, target, b])
  }
  model.layers.forEach((l, i) => {
    if (l.bindings.length !== 76)
      issues.push({
        code: 'binding-count',
        message: `Layer ${i} has ${l.bindings.length} bindings, expected 76`,
        span: l,
      })
    l.bindings.forEach((b) => add(i, b))
  })
  for (const c of model.combos) {
    const active = c.layers ?? model.layers.map((_, i) => i)
    for (const pos of c.keyPositions)
      if (pos < 0 || pos >= 76)
        issues.push({
          code: 'combo-position',
          message: `Combo ${c.name} position ${pos} is out of range`,
          span: c,
        })
    for (const i of active) if (edges[i]) c.bindings.forEach((b) => add(i, b))
  }
  const reachable = (start: number) => {
    const seen = new Set<number>([start])
    const queue = [start]
    for (const n of queue)
      for (const v of edges[n] ?? [])
        if (!seen.has(v)) {
          seen.add(v)
          queue.push(v)
        }
    return seen
  }
  const fromZero = reachable(0)
  model.layers.forEach((l, i) => {
    if (!fromZero.has(i))
      issues.push({
        code: 'unreachable-layer',
        message: `Layer ${i} (${l.name}) is unreachable`,
        span: l,
      })
  })
  for (const [from, to, b] of persistent)
    if (to !== from && !reachable(to).has(from))
      issues.push({
        code: 'no-return',
        message: `Layer ${to} has no path back to layer ${from}`,
        span: b,
      })
  for (let i = 0; i < model.combos.length; i++)
    for (let j = i + 1; j < model.combos.length; j++) {
      const a = model.combos[i],
        b = model.combos[j]
      if (
        a.keyPositions.some((p) => b.keyPositions.includes(p)) &&
        (!a.layers || !b.layers || a.layers.some((l) => b.layers!.includes(l)))
      )
        issues.push({
          code: 'combo-overlap',
          message: `Combos ${a.name} and ${b.name} overlap`,
          span: b,
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
    ...model.behaviors.map((b) => b.label ?? b.name),
    ...model.boardBehaviors,
  ])
  for (const b of [
    ...model.layers.flatMap((l) => l.bindings),
    ...model.combos.flatMap((c) => c.bindings),
    ...model.behaviors.flatMap((x) => x.bindings),
  ])
    if (!known.has(b.behavior) && generated.has(b.behavior))
      issues.push({
        code: 'generated-behavior',
        message: `Behavior &${b.behavior} is generated at build time`,
        span: b,
      })
    else if (!known.has(b.behavior))
      issues.push({
        code: 'undefined-behavior',
        message: `Undefined behavior &${b.behavior}`,
        span: b,
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
