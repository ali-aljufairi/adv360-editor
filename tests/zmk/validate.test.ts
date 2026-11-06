import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, validate } from '../../src/lib/zmk'
import { files } from './fixtures'
const model = () => resolve(files, 'adv360.keymap')

it('flags the unreachable mod layer', () => {
  expect(
    validate(model()).some(
      (item) => item.code === 'unreachable-layer' && item.message.includes("mod can't be reached"),
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
  expect(
    issues.filter((issue) => issue.code === 'binding-count').map((issue) => issue.message),
  ).toEqual(['Layer 1 has 1 bindings, expected 2'])
  expect(issues.some((issue) => issue.code === 'combo-position')).toBe(false)
})

it('uses transparent fall-through as a return path through the lower active layer', () => {
  const file = 'fixtures/issues/transparent-fallthrough-toggle.keymap'
  const source = readFileSync(file, 'utf8')
  const model = resolve({ [file]: source }, file)
  expect(model.layers[0].bindings[75]).toMatchObject({ behavior: 'mo', params: ['3'] })
  expect(model.layers[3].bindings[16]).toMatchObject({ behavior: 'tog', params: ['4'] })
  expect(model.layers[4].bindings[16]).toMatchObject({ behavior: 'trans' })
  expect(model.layers[4].bindings[75]).toMatchObject({ behavior: 'trans' })
  expect(
    validate(model).some(
      (issue) => issue.code === 'no-return' && issue.message.includes('Layer 4'),
    ),
  ).toBe(false)
})
