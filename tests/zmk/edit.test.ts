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

import { files } from './fixtures'

it('edits a single binding on one line and retains neighboring alignment', () => {
  const currentEditor = createEditor(files, 'adv360.keymap')
  const old = currentEditor.model.layers[0].bindings[0]
  const next = currentEditor.model.layers[0].bindings[1]
  currentEditor.setBinding(0, 0, '&kp A')
  const updated = currentEditor.model.layers[0].bindings[1]
  expect(updated.start).toBe(next.start)
  const difference = currentEditor.diff()['adv360.keymap']
  expect(difference.split('\n').filter((item) => /^[-+](?![-+])/.test(item))).toHaveLength(2)
  expect(currentEditor.serialize()['adv360.keymap'].slice(0, old.start)).toBe(
    files['adv360.keymap'].slice(0, old.start),
  )
})

it('inserts a combo without changing existing lines', () => {
  const nextEditor = createEditor(files, 'adv360.keymap')
  nextEditor.addComboRaw('        new_combo { bindings = <&kp A>; key-positions = <1 2>; };')
  const updated = nextEditor.serialize()['adv360.keymap']
  expect(
    updated.replace('        new_combo { bindings = <&kp A>; key-positions = <1 2>; };\n', ''),
  ).toBe(files['adv360.keymap'])
  expect(nextEditor.model.combos).toHaveLength(4)
})

it('edits macros in their source file', () => {
  const otherEditor = createEditor(files, 'adv360.keymap')
  otherEditor.updateMacroRaw(
    'Win_Copy',
    'Win_Copy: Windows_Copy { compatible = "zmk,behavior-macro"; bindings = <&kp C>; };',
  )
  expect(Object.keys(otherEditor.diff())).toEqual(['macros.dtsi'])
  expect(
    otherEditor.model.macros.find((currentItem) => currentItem.label === 'Win_Copy')?.bindings[0]
      .params,
  ).toEqual(['C'])
})

it('updates hold-tap properties and layer names surgically', () => {
  const candidateEditor = createEditor(files, 'adv360.keymap')
  candidateEditor.updateHoldTapProperty('tpf', 'tapping-term-ms', '<250>')
  expect(
    candidateEditor.model.behaviors.find((currentBinding) => currentBinding.label === 'tpf')
      ?.properties['tapping-term-ms'],
  ).toBe('<250>')
  candidateEditor.renameLayer(2, 'utility')
  expect(candidateEditor.model.layers[2].name).toBe('utility')
})

it('adds, updates and removes macros, combos and layers', () => {
  const selectedEditor = createEditor(files, 'adv360.keymap')
  selectedEditor.addMacroRaw(
    'new_macro: new_macro { compatible = "zmk,behavior-macro"; bindings = <&kp A>; };',
    'macros',
    'macros.dtsi',
  )
  expect(selectedEditor.model.macros.some((match) => match.label === 'new_macro')).toBe(true)
  selectedEditor.removeMacro('new_macro')
  selectedEditor.addComboRaw('        new_combo { bindings = <&kp A>; key-positions = <1 2>; };')
  selectedEditor.updateComboRaw(
    'new_combo',
    'new_combo { bindings = <&kp B>; key-positions = <1 2>; };',
  )
  expect(
    selectedEditor.model.combos.find((entry) => entry.name === 'new_combo')?.bindings[0].params,
  ).toEqual(['B'])
  selectedEditor.removeCombo('new_combo')
  selectedEditor.addLayer('        extra { bindings = <&none>; };')
  expect(selectedEditor.model.layers).toHaveLength(5)
  selectedEditor.removeLayer(4)
  expect(selectedEditor.model.layers).toHaveLength(4)
})

it('reverts fixture binding sequences and changes exactly one line per edit', () => {
  fc.assert(
    fc.property(
      fc.array(fc.tuple(fc.integer({ min: 0, max: 75 }), fc.boolean()), { maxLength: 20 }),
      (edits) => {
        const editor = createEditor(files, 'adv360.keymap')
        const history: { key: number; text: string }[] = []
        for (const [key, chooseLong] of edits) {
          const before = editor.serialize()['adv360.keymap'].split('\n')
          const previous = editor.model.layers[0].bindings[key].text
          let replacement = chooseLong ? '&kp LONGER' : '&none'
          if (replacement === previous) replacement = '&kp A'
          history.push({ key, text: previous })
          editor.setBinding(0, key, replacement)
          const after = editor.serialize()['adv360.keymap'].split('\n')
          expect(after.filter((line, index) => line !== before[index])).toHaveLength(1)
        }
        for (const edit of history.reverse()) editor.setBinding(0, edit.key, edit.text)
        expect(editor.serialize()).toEqual(files)
      },
    ),
    { numRuns: 50 },
  )
})

it('removes a fixture layer without introducing whitespace-only or extra blank lines', () => {
  const original = files['adv360.keymap']
  const editor = createEditor(files, 'adv360.keymap')
  editor.removeLayer(1, { force: true })
  const updated = editor.serialize()['adv360.keymap']
  const count = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].length
  expect(count(updated, /^[ \t]+\r?$/gm)).toBeLessThanOrEqual(count(original, /^[ \t]+\r?$/gm))
  expect(count(updated, /\n\r?\n\r?\n/g)).toBeLessThanOrEqual(count(original, /\n\r?\n\r?\n/g))
})

it.each(['macro', 'combo'] as const)('removes the full line for a standalone %s', (kind) => {
  const source =
    '/ {\n  macros {\n    test_macro: test { compatible = "zmk,behavior-macro"; };\n  };\n' +
    '  combos {\n    test_combo { bindings = <&none>; key-positions = <1>; };\n  };\n};\n'
  const editor = createEditor({ keymap: source }, 'keymap')
  if (kind === 'macro') editor.removeMacro('test_macro')
  else editor.removeCombo('test_combo')
  const line = kind === 'macro' ? '    test_macro:' : '    test_combo'
  expect(editor.serialize().keymap).toBe(
    source
      .split('\n')
      .filter((text) => !text.startsWith(line))
      .join('\n'),
  )
})

it('preserves macro text around an edited step and supports no-op writes', () => {
  const source = `/ { macros { m: m { compatible = "zmk,behavior-macro";
    bindings = <&macro_press &macro_press &kp LSHFT>, /* keep */ <&macro_tap &kp A>, <&macro_release &kp LSHFT>;
  }; }; };`
  const editor = createEditor({ x: source }, 'x')
  const bindings = [
    '&macro_press',
    '&kp LSHFT',
    '&macro_tap',
    '&kp A',
    '&macro_release',
    '&kp LSHFT',
  ]
  editor.updateMacro('m', { bindings })
  expect(editor.serialize().x).toBe(source)
  bindings[3] = '&kp B'
  editor.updateMacro('m', { bindings })
  expect(editor.serialize().x).toBe(source.replace('&kp A', '&kp B'))
})

it('preserves hold-tap binding style and adds and removes bare and optional properties', () => {
  const source = `/ { behaviors { ht: ht { compatible = "zmk,behavior-hold-tap";
    bindings = <&kp>, <&kp>;
    quick-tap-ms = <150>;
    retro-tap;
  }; }; combos { c { bindings = <&kp A>; key-positions = <1 2>; timeout-ms = <30>; slow-release; }; }; };`
  const editor = createEditor({ x: source }, 'x')
  editor.updateHoldTap('ht', {
    bindings: ['&mo', '&kp'],
    quickTapMs: null,
    holdTriggerOnRelease: true,
    retroTap: false,
  })
  editor.updateCombo('c', { timeoutMs: null, slowRelease: false })
  const result = editor.serialize().x
  expect(result).toContain('bindings = <&mo>, <&kp>;')
  expect(result).toContain('hold-trigger-on-release;')
  expect(result).not.toMatch(/quick-tap-ms|retro-tap|timeout-ms|slow-release/)
})
