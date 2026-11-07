import { describe, expect, it } from 'vitest'
import { createEditorStore, loadFixtureFiles } from '../../src/lib/editor-state'
import { exportKeymap } from '../../src/lib/export'
import { svgToPng } from '../../src/lib/export/png'
import { describeBinding } from '../../src/lib/legend/describe'
import { fitLegend, lineFits } from '../../src/lib/legend/fit'
import { ADV360_PROFILE } from '../../src/lib/profile'
import { presets, resolveTheme } from '../../src/lib/theme/catalog'

it('renders a standalone board per layer and printable pages', () => {
  const { model, layout } = createEditorStore(loadFixtureFiles(), ADV360_PROFILE).getSnapshot()
  const output = exportKeymap(model, layout, [0, 1], resolveTheme(presets[0], 'dark'))
  expect(output.layers).toHaveLength(2)
  for (const { svg, layer } of output.layers) {
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg.match(/data-key=/g)).toHaveLength(layout.keys.length)
    expect(svg).toContain('<text')
    for (const key of layout.keys) {
      const binding = model.layers[layer].bindings[key.index]
      if (!binding) continue
      const legend = describeBinding(binding, {
        layerNames: model.layers.map((l) => l.displayName ?? l.name),
      })
      for (const label of [legend.primary, legend.secondary ?? '']) {
        const fitted = fitLegend(label, key.w - 0.08)
        expect(
          fitted.text.split('\n').every((line) => lineFits(line, fitted.size, key.w - 0.08)),
        ).toBe(true)
      }
    }
  }
  expect(output.printableDocument.match(/<section>/g)).toHaveLength(2)
  expect(output.printableDocument).toContain('<h2>Legend</h2>')
  expect(output.printableDocument).toContain('<h2>Behaviors</h2>')
  expect(() => exportKeymap(model, layout, [999], resolveTheme(presets[0], 'dark'))).toThrow(
    RangeError,
  )
})
describe('PNG helper', () => {
  it('rejects server use and invalid scales', async () => {
    await expect(svgToPng('<svg/>')).rejects.toThrow('browser')
    await expect(svgToPng('<svg/>', 0)).rejects.toThrow(RangeError)
  })
})
