import { expect, it } from 'vitest'
import { resolve, validate } from '../../src/lib/zmk'
import { files } from './fixtures'
const model = () => resolve(files, 'adv360.keymap')

it('flags the unreachable mod layer', () => {
  expect(
    validate(model()).some(
      (item) => item.code === 'unreachable-layer' && item.message.includes('Layer 2 (mod)'),
    ),
  ).toBe(true)
})

it('reports conflicts, invalid positions, missing behaviors and trapped layers', () => {
  const source =
    '/ { keymap { a { bindings = <&tog 1 &mystery>; }; b { bindings = <&none>; }; }; combos { one { bindings = <&none>; key-positions = <1 90>; }; two { bindings = <&none>; key-positions = <1 2>; }; }; };'
  const issues = validate(resolve({ 'x.keymap': source }, 'x.keymap'), {
    expectedKeyCount: 1,
    expectedKeyPositions: [0],
  })
  for (const code of [
    'binding-count',
    'no-return',
    'undefined-behavior',
    'combo-position',
    'combo-overlap',
  ])
    expect(
      issues.some((i) => i.code === code),
      code,
    ).toBe(true)
})

it('checks layer consistency without assuming a board-specific key count', () => {
  const source = '/ { keymap { a { bindings = <&kp A &kp B>; }; b { bindings = <&kp A>; }; }; };'
  const issues = validate(resolve({ 'small.keymap': source }, 'small.keymap'))
  expect(issues.filter((issue) => issue.code === 'binding-count').map((issue) => issue.message)).toEqual([
    'Layer 1 has 1 bindings, expected 2',
  ])
  expect(issues.some((issue) => issue.code === 'combo-position')).toBe(false)
})
