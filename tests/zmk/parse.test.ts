import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parse } from '../../src/lib/zmk'
import type { Node, Property } from '../../src/lib/zmk'

it('builds the expected keymap tree paths', () => {
  const cst = parse(readFileSync('fixtures/adv360/adv360.keymap', 'utf8'))
  const paths: string[] = []
  const visit = (children: (Node | Property)[], parent: string) => {
    for (const child of children) {
      if (child.kind !== 'node') continue
      const path = child.name === '/' ? '' : `${parent}/${child.name}`
      paths.push(path)
      visit(child.children, path)
    }
  }
  visit(cst.children, '')
  expect(paths).toEqual(
    expect.arrayContaining([
      '/behaviors',
      '/macros',
      '/combos',
      '/keymap/default_layer',
      '/keymap/keypad',
      '/keymap/mod',
      '/keymap/macro',
    ]),
  )
})
