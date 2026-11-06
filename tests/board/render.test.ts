import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Board } from '../../src/components/board/Board'
import { LayerTabs } from '../../src/components/board/LayerTabs'
import { getLayoutSource } from '../../src/lib/layout'
import { ADV360_PROFILE } from '../../src/lib/profile/registry'
import { resolve } from '../../src/lib/zmk'
import { files } from '../zmk/fixtures'

const read = (path: string) => readFileSync(`fixtures/adv360/${path}`, 'utf8')
const model = resolve(files, 'adv360.keymap')
const layout = getLayoutSource(ADV360_PROFILE.layout.source).load(
  read('boards/arm/adv360/adv360-layouts.dtsi'),
  { nodeLabel: ADV360_PROFILE.layout.nodeLabel },
)
const layerNames = model.layers.map((layer) => layer.displayName ?? layer.name)

describe('Board server render', () => {
  it('renders one keycap per key of the active layer, without touching window', () => {
    const html = renderToStaticMarkup(
      createElement(Board, {
        layout,
        bindings: model.layers[0].bindings,
        legendContext: { layerNames },
        selectedKey: 3,
        changedKeys: new Set([2]),
        combos: model.combos,
        layerAccent: 1,
        onSelectKey: () => undefined,
        onActivateKey: () => undefined,
      }),
    )
    const keycaps = html.match(/data-kind="/g) ?? []
    expect(keycaps).toHaveLength(Math.min(layout.keys.length, model.layers[0].bindings.length))
    expect(html).toContain(`aria-label="${layerNames[0]}, key 3:`)
    expect(html).toContain('stroke="var(--arc-combo)"')
    expect(html).toContain('Studio builds only')
  })

  it('renders layer tabs as a tablist with one tab per layer and a warning for unreachable ones', () => {
    const html = renderToStaticMarkup(
      createElement(LayerTabs, {
        layers: layerNames.map((name, index) => ({
          index,
          name,
          unreachable: index === 1,
          access: [],
          summary: '',
        })),
        active: 0,
        onChange: () => undefined,
      }),
    )
    expect(html).toContain('role="tablist"')
    expect(html.match(/role="tab"/g)).toHaveLength(layerNames.length)
    expect(html.match(/role="tooltip"/g)).toHaveLength(1)
    expect(html).toContain('aria-selected="true"')
  })
})
