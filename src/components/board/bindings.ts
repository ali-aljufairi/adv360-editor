import { describeBinding, type DescribeContext, type Legend } from '../../lib/legend/describe'
import type { Combo } from '../../lib/zmk/types'

/** Behaviors whose first parameter names the layer they switch to. */
const LAYER_SWITCHES = new Set(['mo', 'tog', 'to', 'sl', 'lt'])

/**
 * Index of the layer a binding switches to, or undefined when it does not switch layers.
 * Accepts a numeric layer or a layer name from `layerNames`.
 */
export function layerTargetOf(
  binding: { behavior: string; params: string[] },
  layerNames?: string[],
): number | undefined {
  if (!LAYER_SWITCHES.has(binding.behavior.replace(/^&/, ''))) return undefined
  const token = binding.params[0]
  if (token === undefined) return undefined
  if (/^\d+$/.test(token)) return Number(token)
  const named = layerNames?.indexOf(token) ?? -1
  return named >= 0 ? named : undefined
}

/** Accent slot 1–4 for a layer number. Layers beyond four reuse the palette in turn. */
export function layerAccentOf(index: number): 1 | 2 | 3 | 4 {
  return ((Math.max(0, Math.floor(index)) % 4) + 1) as 1 | 2 | 3 | 4
}

/** Plain-text legend, the same wording a keycap shows, for aria labels. */
export function legendText(legend: Legend): string {
  return [legend.primary, legend.secondary].filter(Boolean).join(', ') || 'Empty key'
}

/** Label and Studio-only flag for a combo, read from its binding and preprocessor condition. */
export function comboTag(
  combo: Combo,
  ctx: DescribeContext,
): { label: string; studio: boolean; note?: string } {
  const first = combo.bindings[0]
  const primary = first ? describeBinding(first, ctx).primary : ''
  const label = `⋈ ${primary || combo.name}`
  const condition = combo.condition?.trim()
  if (!condition) return { label, studio: false }
  const studio = /STUDIO/i.test(condition)
  return { label, studio, note: studio ? 'Studio builds only' : `Only when ${condition}` }
}
