import { describe, expect, it } from 'vitest'
import { presets } from '../../src/lib/theme/catalog'
import type { ThemeDef } from '../../src/lib/theme/tokens'
import { appearanceOf, filterThemes, swatchesOf } from '../../src/components/theme-picker/themes'

function terminal(id: string, name: string, background: string): ThemeDef {
  return {
    id,
    name,
    type: 'terminal',
    palette: {
      background,
      foreground: '#eeeeee',
      ansi: Array.from({ length: 16 }, (_, index) => `#00000${index.toString(16)}`),
    },
  }
}

const themes: ThemeDef[] = [
  terminal('t:night', 'Night Owl', '#011627'),
  terminal('t:paper', 'Paper Light', '#fafafa'),
  terminal('t:mocha', 'Catppuccin Mocha', '#1e1e2e'),
  { id: 's:adaptive', name: 'Adaptive Slate', type: 'semantic', theme: {} },
]

const everything = { query: '', appearance: 'all', favoritesOnly: false, favorites: [] } as const

describe('appearanceOf', () => {
  it('classifies terminal palettes by background brightness', () => {
    expect(appearanceOf(themes[0])).toBe('dark')
    expect(appearanceOf(themes[1])).toBe('light')
  })

  it('treats semantic themes as fitting both appearances', () => {
    expect(appearanceOf(themes[3])).toBe('both')
  })

  it('finds both light and dark palettes in the bundled catalog', () => {
    const kinds = new Set(presets.map((theme) => appearanceOf(theme)))
    expect(kinds.has('light')).toBe(true)
    expect(kinds.has('dark')).toBe(true)
  })
})

describe('filterThemes', () => {
  it('returns everything in order when no filter is set', () => {
    expect(filterThemes(themes, everything).map((theme) => theme.id)).toEqual([
      't:night',
      't:paper',
      't:mocha',
      's:adaptive',
    ])
  })

  it('filters by appearance but keeps semantic themes in both lists', () => {
    const dark = filterThemes(themes, { ...everything, appearance: 'dark' })
    expect(dark.map((theme) => theme.id)).toEqual(['t:night', 't:mocha', 's:adaptive'])
    const light = filterThemes(themes, { ...everything, appearance: 'light' })
    expect(light.map((theme) => theme.id)).toEqual(['t:paper', 's:adaptive'])
  })

  it('requires every search word to match name or id, ignoring case', () => {
    const cat = filterThemes(themes, { ...everything, query: 'CAT MOCHA' })
    expect(cat.map((theme) => theme.id)).toEqual(['t:mocha'])
    expect(filterThemes(themes, { ...everything, query: 'night paper' })).toEqual([])
    expect(filterThemes(themes, { ...everything, query: '  t:paper ' })).toHaveLength(1)
  })

  it('limits to favourites when asked, ignoring unknown favourite ids', () => {
    const result = filterThemes(themes, {
      ...everything,
      favoritesOnly: true,
      favorites: ['t:paper', 'unknown'],
    })
    expect(result.map((theme) => theme.id)).toEqual(['t:paper'])
  })

  it('combines appearance, favourites and search', () => {
    const result = filterThemes(themes, {
      query: 'a',
      appearance: 'dark',
      favoritesOnly: true,
      favorites: ['t:night', 't:paper', 's:adaptive'],
    })
    expect(result.map((theme) => theme.id)).toEqual(['s:adaptive'])
  })

  it('does not modify the input', () => {
    const copy = [...themes]
    filterThemes(themes, { ...everything, appearance: 'light' })
    expect(themes).toEqual(copy)
  })
})

describe('swatchesOf', () => {
  it('uses the background and six accents for terminal palettes', () => {
    expect(swatchesOf(themes[0])).toEqual([
      '#011627',
      '#000001',
      '#000002',
      '#000003',
      '#000004',
      '#000005',
      '#000006',
    ])
  })

  it('samples resolved tokens for semantic themes', () => {
    const swatches = swatchesOf(themes[3])
    expect(swatches).toHaveLength(6)
    expect(swatches.every((colour) => colour.length > 0)).toBe(true)
  })
})
