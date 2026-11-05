import type { Node } from './types'

/** A binding may be supplied as DTS text or as a behavior and its parameters. */
export type BindingInput = string | { behavior: string; params?: (string | number)[] }
/** Editable fields of a combo. */
export interface ComboInput {
  name: string
  bindings: BindingInput[]
  keyPositions: number[]
  timeoutMs?: number | null
  layers?: number[]
  requirePriorIdleMs?: number | null
  slowRelease?: boolean
}
/** Editable fields of a macro. */
export interface MacroInput {
  label: string
  name: string
  bindings: BindingInput[]
  waitMs?: number | null
  tapMs?: number | null
}
/** Editable hold-tap properties. */
export interface HoldTapInput {
  flavor?: string
  tappingTermMs?: number | null
  quickTapMs?: number | null
  requirePriorIdleMs?: number | null
  holdTriggerKeyPositions?: number[]
  bindings?: BindingInput[]
  holdTriggerOnRelease?: boolean
  retroTap?: boolean
}
/** Render a binding in DTS notation. */
export function formatBinding(binding: BindingInput): string {
  return typeof binding === 'string'
    ? binding.trim()
    : [`&${binding.behavior.replace(/^&/, '')}`, ...(binding.params ?? [])].join(' ')
}
/** Infer indentation from existing child nodes, falling back to the container's indentation. */
export function indentation(source: string, container: Node): { node: string; unit: string } {
  const lineIndent = (offset: number) =>
    source.slice(source.lastIndexOf('\n', offset - 1) + 1, offset).match(/^[ \t]*/)?.[0] ?? ''
  const parent = lineIndent(container.start)
  const child = container.children.find((item) => item.kind === 'node')
  const node = child ? lineIndent(child.start) : `${parent}${parent.includes('\t') ? '\t' : '    '}`
  return {
    node,
    unit:
      node.startsWith(parent) && node.length > parent.length ? node.slice(parent.length) : '    ',
  }
}
/** Render a new combo or macro using the indentation of its siblings. */
export function formatNode(
  input: ComboInput | MacroInput,
  source: string,
  container: Node,
): string {
  const { node, unit } = indentation(source, container)
  const fields: string[] = []
  if ('label' in input) fields.push('compatible = "zmk,behavior-macro";')
  fields.push(`bindings = <${input.bindings.map(formatBinding).join(' ')}>;`)
  if ('keyPositions' in input) {
    fields.push(`key-positions = <${input.keyPositions.join(' ')}>;`)
    if (input.timeoutMs != null) fields.push(`timeout-ms = <${input.timeoutMs}>;`)
    if (input.layers?.length && !input.layers.includes(-1))
      fields.push(`layers = <${input.layers.join(' ')}>;`)
    if (input.requirePriorIdleMs != null)
      fields.push(`require-prior-idle-ms = <${input.requirePriorIdleMs}>;`)
    if (input.slowRelease) fields.push('slow-release;')
  } else {
    if (input.waitMs != null) fields.push(`wait-ms = <${input.waitMs}>;`)
    if (input.tapMs != null) fields.push(`tap-ms = <${input.tapMs}>;`)
  }
  const label = 'label' in input ? `${input.label}: ` : ''
  return `${node}${label}${input.name} {\n${fields.map((field) => `${node}${unit}${field}`).join('\n')}\n${node}};`
}
