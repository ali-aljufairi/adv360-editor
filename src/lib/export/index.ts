import { boardBounds, keyBox } from '../../components/board/geometry'
import type { PhysicalLayout } from '../layout'
import { describeBinding } from '../legend/describe'
import { fitLegend, LEGEND_SCALE, UNIT_EM } from '../legend/fit'
import type { Tokens } from '../theme/tokens'
import type { Model } from '../zmk'

/** One exported layer: its index, display title and standalone SVG. */
export interface LayerExport {
  layer: number
  title: string
  svg: string
}
/** Every exported layer plus a printable HTML document (one layer per page). */
export interface KeymapExport {
  layers: LayerExport[]
  printableDocument: string
}
const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Render standalone SVGs and a printable HTML document without browser APIs. */
export function exportKeymap(
  model: Model,
  layout: PhysicalLayout,
  layers: number[],
  tokens: Tokens,
): KeymapExport {
  const names = model.layers.map((layer) => layer.displayName ?? layer.name)
  const bounds = boardBounds(layout.keys)
  const unit = 64,
    margin = 12
  const width = bounds.width * unit + margin * 2,
    height = bounds.height * unit + margin * 2
  const result = layers.map((index): LayerExport => {
    const layer = model.layers[index]
    if (!Number.isInteger(index) || !layer) throw new RangeError('Layer not found')
    const keys = layout.keys
      .map((key) => {
        const box = keyBox(key, 0.04),
          binding = layer.bindings[key.index]
        const legend = binding
          ? describeBinding(binding, { layerNames: names })
          : { primary: '', kind: 'none' as const }
        const primary = fitLegend(legend.primary, box.width)
        const secondary = fitLegend(legend.secondary ?? '', box.width)
        const left = (box.left - bounds.minX) * unit + margin,
          top = (box.top - bounds.minY) * unit + margin
        const width = box.width * unit,
          height = box.height * unit
        const px = (box.left + box.originX - bounds.minX) * unit + margin,
          py = (box.top + box.originY - bounds.minY) * unit + margin
        const text = (fitted: typeof primary, center: number, color: string, multiplier = 1) => {
          const size = (unit / UNIT_EM) * LEGEND_SCALE[fitted.size] * multiplier
          const lines = fitted.text.split('\n')
          return `<text x="${left + width / 2}" y="${center - (lines.length - 1) * size * 0.55}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" fill="${escape(color)}">${lines.map((line, i) => `<tspan x="${left + width / 2}" dy="${i ? size * 1.1 : 0}">${escape(line)}</tspan>`).join('')}</text>`
        }
        return `<g data-key="${key.index}" transform="rotate(${box.rotate} ${px} ${py})"><rect x="${left}" y="${top}" width="${width}" height="${height}" rx="4" fill="${escape(tokens['keycap-top'])}" stroke="${escape(tokens['border-base'])}"/>${text(primary, top + height * (legend.secondary ? 0.42 : 0.5), tokens['keycap-legend'])}${legend.secondary ? text(secondary, top + height * 0.76, tokens['keycap-sublegend'], 0.75) : ''}</g>`
      })
      .join('')
    return {
      layer: index,
      title: names[index],
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(names[index])}"><rect width="100%" height="100%" fill="${escape(tokens['surface-canvas'])}"/><g font-family="sans-serif">${keys}</g></svg>`,
    }
  })
  const behaviorSummary =
    model.behaviors
      .map((behavior) => `${behavior.label ?? behavior.name} (${behavior.compatible})`)
      .join(', ') || 'None defined'
  const pages = result
    .map(
      (layer) =>
        `<section><h1>${escape(layer.title)}</h1>${layer.svg}<h2>Legend</h2><p>Primary text: key action; smaller text: secondary or hold action. Transparent keys inherit from lower layers; empty keys do nothing.</p><h2>Behaviors</h2><p>${escape(behaviorSummary)}</p></section>`,
    )
    .join('')
  return {
    layers: result,
    printableDocument: `<!doctype html><html><head><meta charset="utf-8"><title>Keymap</title><style>@page{size:landscape;margin:12mm}body{font-family:sans-serif}section{break-after:page}section:last-child{break-after:auto}svg{width:100%;height:auto;max-height:65vh}h1,h2,p{margin:0.4em 0}</style></head><body>${pages}</body></html>`,
  }
}
