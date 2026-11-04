import { contrast } from '../../lib/theme/color'
import { resolveTheme } from '../../lib/theme/catalog'
import type { ThemeDef } from '../../lib/theme/tokens'

export type AppearanceFilter = 'all' | 'light' | 'dark'

/** Whether a palette's background reads as light or dark. Semantic themes adapt to both. */
export type Appearance = 'light' | 'dark' | 'both'

/** Filter, search and favourite options for the theme list. */
export interface ThemeFilter {
  query: string
  appearance: AppearanceFilter
  favoritesOnly: boolean
  favorites: readonly string[]
}

/**
 * Describe the appearance a theme is designed for. Terminal palettes are light when their
 * background is brighter against black than against white; semantic themes define both modes.
 * @param theme The theme to classify.
 * @returns 'light', 'dark', or 'both' for semantic themes.
 */
export function appearanceOf(theme: ThemeDef): Appearance {
  if (theme.type === 'semantic' || !theme.palette) return 'both'
  const background = theme.palette.background
  return contrast(background, '#000000') >= contrast(background, '#ffffff') ? 'light' : 'dark'
}

/**
 * Filter a theme list by appearance, favourites and a search query. Every whitespace-separated
 * word in the query must appear in the theme name or id, ignoring case. Semantic themes match
 * every appearance filter. Order is preserved.
 * @param themes Themes to filter. The input is not modified.
 * @param filter Current filter state.
 * @returns The themes that pass every filter.
 */
export function filterThemes(themes: readonly ThemeDef[], filter: ThemeFilter): ThemeDef[] {
  const words = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const favorites = new Set(filter.favorites)
  return themes.filter((theme) => {
    const appearance = appearanceOf(theme)
    if (filter.appearance !== 'all' && appearance !== 'both' && appearance !== filter.appearance) {
      return false
    }
    if (filter.favoritesOnly && !favorites.has(theme.id)) return false
    const haystack = `${theme.name} ${theme.id}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/**
 * Colours that stand in for a theme in a list row: the background followed by six accents for
 * terminal palettes, or the main surface and layer colours for semantic themes.
 * @param theme The theme to sample.
 * @returns Six or more CSS colour strings.
 */
export function swatchesOf(theme: ThemeDef): string[] {
  if (theme.palette) {
    return [theme.palette.background, ...theme.palette.ansi.slice(1, 7)]
  }
  const tokens = resolveTheme(theme, 'dark')
  return [
    tokens['surface-canvas'],
    tokens['layer-1'],
    tokens['layer-2'],
    tokens['layer-3'],
    tokens['layer-4'],
    tokens['status-success'],
  ]
}
