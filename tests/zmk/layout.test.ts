import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadPhysicalLayout } from '../../src/lib/zmk'
import { loadZmkDtsLayout } from '../../src/lib/layout'
const dir = 'fixtures/adv360/'

it('loads the physical key layout', () => {
  const keys = loadPhysicalLayout(readFileSync(dir + 'info.json', 'utf8'))
  expect(keys).toHaveLength(76)
  expect(keys[0]).toMatchObject({
    index: 0,
    x: 0,
    y: 0.25,
    w: 1.25,
    h: 1,
    r: 0,
  })
})

it('parses the Adv360 ZMK physical layout in binding order', () => {
  const json = loadPhysicalLayout(readFileSync(dir + 'info.json', 'utf8'))
  const dts = loadZmkDtsLayout(
    readFileSync(dir + 'boards/arm/adv360/adv360-layouts.dtsi', 'utf8'),
    { nodeLabel: 'physical_layout0' },
  )
  expect(dts.keys).toHaveLength(76)
  expect(dts.name).toBe('Default')
  expect(dts.source).toBe('zmk-dts')
  expect(dts.verified).toBe(true)
  expect(dts.keys.map(({ x, y, w, h, r, rx, ry }) => [x, y, w, h, r, rx ?? 0, ry ?? 0])).toEqual(
    json.map(({ x, y, w, h, r, rx, ry }) => [x, y, w, h, r, rx ?? 0, ry ?? 0]),
  )
})

it('selects one of multiple ZMK physical layouts by DTS label', () => {
  const source = '/ { first: one { compatible = "zmk,physical-layout"; display-name = "One"; keys = <&key_physical_attrs 100 100 0 0 0 0 0>; }; second: two { compatible = "zmk,physical-layout"; display-name = "Two"; keys = <&key_physical_attrs 100 100 100 0 0 0 0>; }; };'
  expect(loadZmkDtsLayout(source, { nodeLabel: 'second' })).toMatchObject({
    name: 'Two',
    keys: [{ index: 0, x: 1 }],
  })
})
