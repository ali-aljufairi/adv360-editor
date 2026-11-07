import { describe, expect, it } from 'vitest'
import { presets, resolveTheme } from '../../src/lib/theme/catalog'
import { contrast } from '../../src/lib/theme/color'

const surfaces = ['surface-canvas', 'surface-panel', 'surface-raised', 'surface-hover'] as const
const texts = ['text-primary', 'text-secondary', 'text-muted'] as const

describe('theme text contrast', () => {
  it('keeps body text at 4.5:1 or better on every surface', () => {
    const failures: string[] = []
    for (const preset of presets)
      for (const mode of ['light', 'dark'] as const) {
        const tokens = resolveTheme(preset, mode)
        for (const text of texts)
          for (const surface of surfaces) {
            const ratio = contrast(tokens[text], tokens[surface])
            if (ratio < 4.5)
              failures.push(`${preset.name} ${mode} ${text}/${surface} ${ratio.toFixed(2)}`)
          }
      }
    expect(failures).toEqual([])
  })
})
