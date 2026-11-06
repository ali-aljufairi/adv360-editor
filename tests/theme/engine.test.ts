import { describe, expect, it } from 'vitest'
import { presets, resolveTheme } from '../../src/lib/theme/catalog'
import { contrast } from '../../src/lib/theme/color'
import { parseGhostty } from '../../src/lib/theme/parseGhostty'
import { fromOpenCode } from '../../src/lib/theme/opencode'

describe('theme engine', () => {
  it('meets contrast targets for all presets and modes', () => {
    for (const value405 of presets)
      for (const mode of ['light', 'dark'] as const) {
        const value495 = resolveTheme(value405, mode)
        expect(
          contrast(value495['keycap-legend'], value495['keycap-face']),
          value405.name,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrast(value495['keycap-sublegend'], value495['keycap-face']),
          value405.name,
        ).toBeGreaterThanOrEqual(3)
        for (const value795 of ['layer-1', 'layer-2', 'layer-3', 'layer-4'] as const)
          expect(
            contrast(value495[value795], value495['surface-canvas']),
            value405.name,
          ).toBeGreaterThanOrEqual(3)
      }
  })
  it('excludes uncleared terminal palettes', () => {
    for (const value1059 of presets)
      if (value1059.type === 'terminal')
        expect(['MIT', 'Apache-2.0']).toContain(
          (value1059 as unknown as { license: string }).license,
        )
  })
  it('maps representative palettes', () => {
    expect(
      ['Catppuccin Mocha', 'Catppuccin Latte', 'TokyoNight'].map((name) =>
        resolveTheme(
          presets.find((value1408) => value1408.name === name)!,
          'dark',
        ),
      ),
    ).toMatchSnapshot()
  })
  it('parses Ghostty and OpenCode overrides', () => {
    const value1580 = parseGhostty(
      'background = #000\nforeground = #fff\npalette = 4=#112233\nfont-size = 14',
    )
    expect(value1580.ansi[4]).toBe('#112233')
    const base = resolveTheme(presets[0], 'dark')
    const result = fromOpenCode(
      {
        id: 'x',
        name: 'x',
        type: 'semantic',
        defs: { blue: '#123456' },
        theme: { background: 'blue', unknown: '#fff' },
      },
      'dark',
      base,
    )
    expect(result.tokens['surface-canvas']).toBe('#123456')
    expect(result.unknown).toEqual(['unknown'])
  })
})
