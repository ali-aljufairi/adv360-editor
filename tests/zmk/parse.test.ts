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

import { files } from './fixtures'
import { serialize } from '../../src/lib/zmk'

it('round trips every fixture byte for byte', () => {
  for (const [path, source] of Object.entries(files))
    expect(serialize(parse(source, path))).toBe(source)
})

it('preserves exotic syntax', () => {
  const currentSource =
    '/ { exotic@0 { odd = /bits/ 64 <0x1234>; strange = [aa bb]; /* untouched */ }; };\n'
  expect(serialize(parse(currentSource))).toBe(currentSource)
})
