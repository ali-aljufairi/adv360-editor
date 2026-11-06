/** Browser storage key for favourite theme ids. */
export const favoritesStorageKey = 'theme-favorites'

/**
 * Read favourite theme ids from this browser. Storage can be blocked or hold malformed data, in
 * which case the list is empty.
 * @returns Favourite ids, in the order they were saved.
 */
export function loadFavorites(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]')
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * Save favourite theme ids in this browser. Failures are ignored; favourites then last only for
 * the current page.
 * @param ids Favourite ids to save.
 */
export function saveFavorites(ids: readonly string[]): void {
  try {
    localStorage.setItem(favoritesStorageKey, JSON.stringify(ids))
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * Add or remove one id from a favourites list.
 * @param ids Current favourite ids.
 * @param id The theme id to toggle.
 * @returns A new list with the id added, or removed if it was present.
 */
export function toggleFavorite(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}
