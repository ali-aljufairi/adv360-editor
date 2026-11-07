import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Board } from '../../src/components/board/Board'
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

describe('Board multi-selection', () => {
  it('marks every selected key as selected, not only the active one', () => {
    const html = renderToStaticMarkup(
      createElement(Board, {
        layout,
        bindings: model.layers[0].bindings,
        legendContext: { layerNames },
        selectedKey: 3,
        selectedKeys: new Set<number>([3, 4, 5]),
        changedKeys: new Set<number>(),
        combos: model.combos,
        layerAccent: 1,
        onSelectKey: () => undefined,
        onActivateKey: () => undefined,
      }),
    )
    expect(html.match(/data-selected="true"/g)).toHaveLength(3)
  })
})
