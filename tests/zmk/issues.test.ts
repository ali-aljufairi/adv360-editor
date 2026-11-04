import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createEditor, parse, resolve, serialize, validate, loadPhysicalLayout } from '../../src/lib/zmk'

const issueFixtures = Object.fromEntries(
  readdirSync('fixtures/issues')
    .filter((path) => path.endsWith('.keymap'))
    .map((path) => [path, readFileSync(`fixtures/issues/${path}`, 'utf8')]),
)

it('round trips every real-world issue fixture byte for byte', () => {
  for (const [file, source] of Object.entries(issueFixtures))
    expect(serialize(parse(source, file)), file).toBe(source)
})

it('extracts each fixture into a useful model and reports no syntax errors', () => {
  for (const [file, source] of Object.entries(issueFixtures)) {
    const model = resolve({ [file]: source }, file)
    expect(model.layers.length, file).toBeGreaterThan(0)
    expect(model.layers[0].bindings.length, file).toBeGreaterThan(0)
    expect(validate(model).filter((issue) => issue.severity === 'error'), file).toEqual([])
  }

  const asMacro = resolve(issueFixtures, '103-define-as-binding.keymap')
  const asBinding = asMacro.layers[0].bindings[0]
  expect(asBinding).toMatchObject({
    text: 'AS(Q)',
    editable: false,
    reason: expect.stringMatching(/preprocessor/i),
  })
  expect(() => createEditor(issueFixtures, '103-define-as-binding.keymap').setBinding(0, 0, '&kp B'))
    .toThrow(/opaque|preprocessor/i)

  const includes = resolve(issueFixtures, '198-local-includes.keymap')
  expect(includes.missingIncludes).toEqual(expect.arrayContaining(['keymap_swiss_de.h', 'macros.dtsi']))

  const addressed = parse(issueFixtures['39-addressed-node.keymap'])
  expect(addressed.children.flatMap((item) => item.kind === 'node' ? item.children : []))
    .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'node', name: 'foo@123' })]))

  const branches = resolve(issueFixtures, '147-ifdef-duplicate-layers.keymap')
  expect(branches.layers.map((layer) => layer.name)).toEqual(['default_layer', 'keymap_alt', 'default_layer', 'keymap_alt'])

  const nested = resolve(issueFixtures, '41-nested-spaced-functions.keymap')
  expect(nested.layers[0].bindings[0].params).toEqual(['LS( LA(F))'])

  const placeholders = resolve(issueFixtures, '158-repeated-macro-placeholders.keymap')
  const macroSource = issueFixtures['158-repeated-macro-placeholders.keymap']
  expect(macroSource.match(/MACRO_PLACEHOLDER/g)).toHaveLength(2)
  expect(placeholders.behaviors.find((behavior) => behavior.name === 'repeat')?.bindings).toHaveLength(4)

  const noLayerRestriction = resolve(issueFixtures, '83-combo-all-layers.keymap').combos[0]
  expect(noLayerRestriction.layers).toBeUndefined()

  const conditional = resolve(issueFixtures, '64-conditional-layers.keymap')
  expect(conditional.conditionalLayers).toEqual([
    expect.objectContaining({ name: 'tri_layer', ifLayers: [1, 2], thenLayer: 3 }),
  ])

  const macro344 = resolve(issueFixtures, '344-long-macro-sequences.keymap')
  expect(macro344.macros.find((macro) => macro.name === 'lorem_short')?.bindings.length).toBe(420)
  const macro254 = resolve(issueFixtures, '254-long-macro-sequences.keymap')
  expect(macro254.macros.find((macro) => macro.name === 'long_text')?.bindings.length).toBe(400)

  const zeroAndMulti = resolve(issueFixtures, '304-zero-valued-params.keymap')
  expect(zeroAndMulti.behaviors.find((behavior) => behavior.name === 'zero')?.properties['tapping-term-ms']).toBe('<0>')
  expect(zeroAndMulti.layers[0].bindings[0].params).toEqual(['BT_SEL', '0'])

  const holdTap = resolve(issueFixtures, '77-hold-tap-parameters.keymap')
  expect(holdTap.behaviors.find((behavior) => behavior.name === 'hold_preferred')?.properties['tapping-term-ms']).toBe('<0>')

  const unicode = resolve(issueFixtures, 'utf8-comments-unicode-behaviors.keymap')
  expect(unicode.behaviors.find((behavior) => behavior.name === 'greeting')?.properties.label)
    .toContain('挨拶 ✨')
})

it('edits one intended binding in every fixture without changing neighboring bytes', () => {
  for (const [file, source] of Object.entries(issueFixtures)) {
    const editor = createEditor({ [file]: source }, file)
    const targetIndex = editor.model.layers[0].bindings.findIndex(
      (binding) => binding.editable && binding.text.length === '&kp Z'.length,
    )
    expect(targetIndex, file).toBeGreaterThanOrEqual(0)
    const target = editor.model.layers[0].bindings[targetIndex]
    const replacement = target.text === '&kp A' ? '&kp Z' : '&kp A'
    editor.setBinding(0, targetIndex, replacement)
    expect(editor.serialize()[file]).toBe(
      source.slice(0, target.start) + replacement + source.slice(target.end),
    )
  }
})

it('removes an all-layer combo restriction instead of writing an empty list', () => {
  const file = '83-combo-all-layers.keymap'
  const source = issueFixtures[file]
  const editor = createEditor({ [file]: source }, file)
  editor.updateCombo('all_combo', { layers: [0] })
  expect(editor.serialize()[file]).toContain('layers = <0>;')
  editor.updateCombo('all_combo', { layers: [] })
  expect(editor.serialize()[file]).not.toMatch(/layers\s*=\s*<>/)
  expect(editor.serialize()[file]).not.toContain('layers =')
  const created = createEditor({ new: '/ { keymap { default { bindings = <&kp A>; }; }; combos { }; };' }, 'new')
  created.addCombo({ name: 'all', bindings: ['&kp ESC'], keyPositions: [0], layers: [] })
  expect(created.serialize().new).not.toContain('layers =')
})

it('compares info.json key count and reports stale layer-zero labels as informational', () => {
  const layout = loadPhysicalLayout(readFileSync('fixtures/adv360/info.json', 'utf8'))
  const model = resolve({
    ...Object.fromEntries(
      readdirSync('fixtures/adv360', { recursive: true, encoding: 'utf8' })
        .filter((path) => /\.(keymap|dtsi)$/.test(path))
        .map((path) => [path, readFileSync(`fixtures/adv360/${path}`, 'utf8')]),
    ),
  }, 'adv360.keymap')
  const issues = validate(model, { physicalLayout: layout })
  expect(issues.some((issue) => issue.code === 'info-key-count')).toBe(false)
  expect(issues).toContainEqual(
    expect.objectContaining({
      code: 'info-label-mismatch',
      severity: 'info',
      key: 35,
      message: expect.stringContaining('LEFT_ALT'),
    }),
  )

  const smallLayout = layout.slice(0, 1)
  expect(validate(model, { physicalLayout: smallLayout }).some((issue) => issue.code === 'info-key-count'))
    .toBe(true)
})
