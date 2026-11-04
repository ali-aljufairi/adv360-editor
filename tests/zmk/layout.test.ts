import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadPhysicalLayout } from '../../src/lib/zmk'
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
