import { expect, it } from 'vitest'
import { resolve } from '../../src/lib/zmk'
import { files } from './fixtures'
const model = () => resolve(files, 'adv360.keymap')

it('extracts layers, behaviors, included and inline macros, and guarded combos', () => {
  const match = model()
  expect(match.layers.map((item) => item.name)).toEqual([
    'default_layer',
    'keypad',
    'mod',
    'macro',
    'windows',
  ])
  expect(match.layers.map((currentItem) => currentItem.bindings.length)).toEqual([
    76, 76, 76, 76, 76,
  ])
  expect(match.behaviors.find((nextItem) => nextItem.label === 'tpf')?.compatible).toBe(
    'zmk,behavior-hold-tap',
  )
  expect(match.macros).toHaveLength(35)
  expect(
    match.macros.some(
      (otherItem) => otherItem.label === 'mail' && otherItem.file === 'adv360.keymap',
    ),
  ).toBe(true)
  expect(
    match.macros.some(
      (candidateItem) => candidateItem.label === 'Win_Copy' && candidateItem.file === 'macros.dtsi',
    ),
  ).toBe(true)
  expect(match.combos).toHaveLength(2)
  expect(
    match.combos.find((selectedItem) => selectedItem.name === 'combo_studio_unlock')?.condition,
  ).toContain('CONFIG_ZMK_STUDIO')
})

it('keeps nested function arguments and preprocessor branches', () => {
  const currentMatch = model()
  expect(currentMatch.layers[0].bindings[6].params).toEqual(['LG(LC(NUMBER_4))'])
  const source =
    '/ { combos {\n#if A\n a { key-positions = <1>; };\n#elif B\n b { key-positions = <2>; };\n#else\n c { key-positions = <3>; };\n#endif\n}; };'
  const combos = resolve({ x: source }, 'x').combos
  expect(combos.map((entry) => entry.condition)).toEqual(['A', '!(A) && B', '!(A) && !(B)'])
})
