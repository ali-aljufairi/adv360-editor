import { expect, it } from 'vitest'
import fc from 'fast-check'
import { createEditor } from '../../src/lib/zmk'

it('reverts sequences of edits byte for byte and changes only their rows', () => {
  const source = '/ { keymap { layer { bindings = <\n&kp A  &kp B\n&kp C &kp D\n>; }; }; };\n'
  fc.assert(
    fc.property(
      fc.array(
        fc.tuple(fc.integer({ min: 0, max: 3 }), fc.constantFrom('&kp A', '&kp LONGER', '&none')),
        { maxLength: 20 },
      ),
      (edits) => {
        const editor = createEditor({ x: source }, 'x')
        const previous: { key: number; text: string }[] = []
        for (const [key, text] of edits) {
          const before = editor.serialize().x.split('\n')
          previous.push({ key, text: editor.model.layers[0].bindings[key].text })
          editor.setBinding(0, key, text)
          const after = editor.serialize().x.split('\n')
          expect(after.filter((line, index) => line !== before[index]).length).toBeLessThanOrEqual(
            1,
          )
        }
        for (const edit of previous.reverse()) editor.setBinding(0, edit.key, edit.text)
        expect(editor.serialize().x).toBe(source)
      },
    ),
  )
})

it.each(['&kp LONGER', '&n'])(
  'keeps neighboring rows and padded columns aligned for %s',
  (binding) => {
    const source =
      '/ { keymap { layer { bindings = <\n&kp A          &kp B\n&kp C &kp D\n>; }; }; };\n'
    const editor = createEditor({ x: source }, 'x')
    const nextStart = editor.model.layers[0].bindings[1].start
    editor.setBinding(0, 0, binding)
    expect(editor.model.layers[0].bindings[1].start).toBe(nextStart)
    expect(editor.serialize().x.split('\n')[2]).toBe(source.split('\n')[2])
  },
)

it('limits an overlong binding edit to its row when padding runs out', () => {
  const source = '/ { keymap { layer { bindings = <\n&kp A &kp B\n&kp C &kp D\n>; }; }; };\n'
  const editor = createEditor({ x: source }, 'x')
  editor.setBinding(0, 0, '&kp MUCH_LONGER')
  expect(editor.serialize().x.split('\n')[2]).toBe(source.split('\n')[2])
})
