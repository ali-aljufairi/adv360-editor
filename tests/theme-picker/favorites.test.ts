import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  favoritesStorageKey,
  loadFavorites,
  saveFavorites,
  toggleFavorite,
} from '../../src/components/theme-picker/favorites'

function stubStorage(values: Record<string, string>, throws = false) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => {
      if (throws) throw new Error('blocked')
      return values[key] ?? null
    },
    setItem: (key: string, value: string) => {
      if (throws) throw new Error('blocked')
      values[key] = value
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('favourites storage', () => {
  it('round-trips ids through localStorage', () => {
    const values: Record<string, string> = {}
    stubStorage(values)
    saveFavorites(['a', 'b'])
    expect(values[favoritesStorageKey]).toBe('["a","b"]')
    expect(loadFavorites()).toEqual(['a', 'b'])
  })

  it('ignores malformed stored data', () => {
    stubStorage({ [favoritesStorageKey]: '{"not":"a list"}' })
    expect(loadFavorites()).toEqual([])
    stubStorage({ [favoritesStorageKey]: '[1,"ok",null]' })
    expect(loadFavorites()).toEqual(['ok'])
  })

  it('does not throw when storage is blocked', () => {
    stubStorage({}, true)
    expect(() => saveFavorites(['a'])).not.toThrow()
    expect(loadFavorites()).toEqual([])
  })

  it('returns empty when localStorage does not exist', () => {
    expect(loadFavorites()).toEqual([])
    expect(() => saveFavorites(['a'])).not.toThrow()
  })
})

describe('toggleFavorite', () => {
  it('adds a missing id and removes a present one without mutating the input', () => {
    const ids = ['a']
    expect(toggleFavorite(ids, 'b')).toEqual(['a', 'b'])
    expect(toggleFavorite(ids, 'a')).toEqual([])
    expect(ids).toEqual(['a'])
  })
})
