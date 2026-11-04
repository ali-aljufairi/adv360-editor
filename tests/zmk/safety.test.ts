import { expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  createEditor,
  LayerReferencedError,
  UnresolvedLayerSymbolError,
  UnsupportedLayerExpressionError,
  parse,
  resolve,
  serialize,
  validate,
} from '../../src/lib/zmk'

const files = Object.fromEntries(
  readdirSync('fixtures/adv360', { recursive: true, encoding: 'utf8' })
    .filter((path) => /\.(keymap|dtsi)$/.test(path))
    .map((path) => [path, readFileSync(`fixtures/adv360/${path}`, 'utf8')]),
)

it('resolves version and reports no missing includes', () => {
  const model = resolve(files, 'adv360.keymap')
  expect(model.missingIncludes).toEqual([])
  expect(
    validate(model)
      .filter((issue) => issue.code === 'undefined-behavior')
      .map((issue) => issue.message),
  ).toEqual([])
})

it('preserves parsing after an expression containing shift operators', () => {
  const cst = parse('/ { node { value = <(1 << 2)>; next = <3>; }; };')
  const root = cst.children[0]
  if (root.kind !== 'node') throw new Error('missing root')
  const node = root.children[0]
  if (node.kind !== 'node') throw new Error('missing node')
  expect(node.children.map((property) => property.name)).toEqual(['value', 'next'])
})

it('rejects removing a referenced layer unless forced', () => {
  const source = '/ { keymap { a { bindings = <&mo 1>; }; b { bindings = <&none>; }; }; };'
  const editor = createEditor({ x: source }, 'x')
  expect(() => editor.removeLayer(1)).toThrow(LayerReferencedError)
  editor.removeLayer(1, { force: true })
  expect(editor.model.layers[0].bindings[0].behavior).toBe('none')
})

it('rewrites references when moving layers', () => {
  const source = '/ { keymap { a { bindings = <&mo 1>; }; b { bindings = <&to 0>; }; }; };'
  const editor = createEditor({ x: source }, 'x')
  editor.moveLayer(0, 1)
  expect(editor.model.layers.map((layer) => layer.name)).toEqual(['b', 'a'])
  expect(editor.model.layers.map((layer) => layer.bindings[0].params)).toEqual([['1'], ['0']])
})

it('reports build-generated behaviors as informational', () => {
  const issues = validate(resolve(files, 'adv360.keymap'))
  expect(
    issues
      .filter((issue) => issue.code === 'generated-behavior')
      .every((issue) => issue.severity === 'info'),
  ).toBe(true)
  expect(issues.some((issue) => issue.code === 'generated-behavior')).toBe(true)
})

it('allows callers to configure generated behavior names', () => {
  const model = resolve({ x: '/ { keymap { a { bindings = <&built>; }; }; };' }, 'x')
  expect(validate(model, { generatedBehaviors: ['built'] })).toContainEqual(
    expect.objectContaining({ code: 'generated-behavior', severity: 'info' }),
  )
  expect(validate(model, { generatedBehaviors: [] })).toContainEqual(
    expect.objectContaining({ code: 'undefined-behavior', severity: 'error' }),
  )
})

it('recognizes behavior labels from board dtsi files', () => {
  const model = resolve(
    {
      x: '/ { keymap { a { bindings = <&board_macro>; }; }; };',
      'boards/example/macros.dtsi': 'board_macro: example { compatible = "zmk,behavior-macro"; };',
    },
    'x',
  )
  expect(validate(model).filter((issue) => issue.code === 'undefined-behavior')).toEqual([])
})

const synthetic = (extra: string, binding = '&none') =>
  `/ { keymap { a { bindings = <${binding}>; }; b { bindings = <&none>; }; c { bindings = <&none>; }; }; ${extra} };`

it('replaces forced momentary and toggle layer bindings', () => {
  const e = createEditor({ x: synthetic('', '&mo 1 &tog 1 &to 1 &sl 1 &mo 2') }, 'x')
  const changes = e.removeLayer(1, { force: true })
  expect(e.serialize().x).toContain('<&none &none &none &none &mo 1>')
  expect(changes.every((change) => change.reason && change.before)).toBe(true)
})

it('preserves the tap key when removing a layer-tap reference', () => {
  const e = createEditor({ x: synthetic('', '&lt 1 SPACE') }, 'x')
  e.removeLayer(1, { force: true })
  expect(e.serialize().x).toContain('&kp SPACE')
})

it('removes combo layer numbers and empty combos', () => {
  const e = createEditor(
    { x: synthetic('combos { one { layers = <1 2>; }; two { layers = <1>; }; };') },
    'x',
  )
  expect(() => e.removeLayer(1)).toThrow(LayerReferencedError)
  e.removeLayer(1, { force: true })
  expect(e.serialize().x).toMatch(/layers = <\s*1>/)
  expect(e.serialize().x).not.toContain('two {')
})

it('removes conditional entries referring to the removed layer', () => {
  const e = createEditor(
    {
      x: synthetic(
        'conditional { compatible = "zmk,conditional-layers"; one { if-layers = <0 1>; then-layer = <2>; }; two { if-layers = <0>; then-layer = <1>; }; three { if-layers = <0>; then-layer = <2>; }; };',
      ),
    },
    'x',
  )
  e.removeLayer(1, { force: true })
  expect(e.serialize().x).not.toContain('one {')
  expect(e.serialize().x).not.toContain('two {')
  expect(e.serialize().x).toContain('then-layer = <1>')
})

it('force removes the fixture keypad and round trips the result', () => {
  const e = createEditor(files, 'adv360.keymap')
  const changes = e.removeLayer(1, { force: true })
  expect(changes.some((c) => c.before === '&mo 1' && c.after === '&none')).toBe(true)
  expect(changes.some((c) => c.before === '&tog 1' && c.after === '&none')).toBe(true)
  expect(changes.some((c) => c.before === '3' && c.after === '2')).toBe(true)
  expect(e.model.layers).toHaveLength(3)
  for (const [file, source] of Object.entries(e.serialize()))
    expect(serialize(parse(source, file))).toBe(source)
})

it('ignores comments and string literals during layer rewriting', () => {
  const source = synthetic('other { text = "&mo 2"; };', '&mo 2 /* &mo 2 */ // &tog 2\n &to 2')
  const e = createEditor({ x: source }, 'x')
  e.removeLayer(1)
  expect(e.serialize().x).toContain('&mo 1 /* &mo 2 */ // &tog 2\n &to 1')
  expect(e.serialize().x).toContain('"&mo 2"')
})

it('rewrites multiple references on one line', () => {
  const e = createEditor({ x: synthetic('', '&mo 2 &tog 2 &to 2') }, 'x')
  e.removeLayer(1)
  expect(e.serialize().x).toContain('&mo 1 &tog 1 &to 1')
})

it('rewrites a binding split across lines', () => {
  const e = createEditor({ x: synthetic('', '&mo\n 2') }, 'x')
  e.removeLayer(1)
  expect(e.serialize().x).toContain('&mo\n 1')
})

it('rewrites a numeric symbol definition instead of its binding', () => {
  const e = createEditor({ x: '#define TARGET 2\n' + synthetic('', '&mo TARGET &tog TARGET') }, 'x')
  const changes = e.removeLayer(1)
  expect(e.serialize().x).toContain('#define TARGET 1')
  expect(e.serialize().x).toContain('&mo TARGET &tog TARGET')
  expect(changes).toHaveLength(1)
})

it('reports locations of unresolved layer symbols without editing', () => {
  const source = synthetic('', '&mo MISSING &tog OTHER')
  const e = createEditor({ x: source }, 'x')
  try {
    e.removeLayer(1)
    throw new Error('expected error')
  } catch (error) {
    expect(error).toBeInstanceOf(UnresolvedLayerSymbolError)
    expect(
      (error as UnresolvedLayerSymbolError).locations.map((p) => source.slice(p.start, p.end)),
    ).toEqual(['MISSING', 'OTHER'])
  }
  expect(e.serialize().x).toBe(source)
})

it('rejects arithmetic layer expressions without editing', () => {
  const source = synthetic('', '&mo (BASE+1)')
  const e = createEditor({ x: source }, 'x')
  expect(() => e.moveLayer(0, 1)).toThrow(UnsupportedLayerExpressionError)
  expect(e.serialize().x).toBe(source)
})
