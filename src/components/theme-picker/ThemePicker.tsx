import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTheme } from '../../lib/theme/ThemeProvider'
import type { ThemePreference } from '../../lib/theme/runtime'
import type { Mode, ThemeDef } from '../../lib/theme/tokens'
import { useFocusTrap } from '../panels/useFocusTrap'
import { loadFavorites, saveFavorites, toggleFavorite } from './favorites'
import { parseThemeImport } from './importTheme'
import { appearanceOf, filterThemes, swatchesOf } from './themes'
import type { AppearanceFilter, ThemeFilter } from './themes'

export interface ThemePickerProps {
  open: boolean
  onClose(): void
} // uses useTheme()

const appearanceChoices: Array<[AppearanceFilter, string]> = [
  ['all', 'All'],
  ['light', 'Light'],
  ['dark', 'Dark'],
]

const modeChoices: Array<[ThemePreference['mode'], string]> = [
  ['system', 'Follow system'],
  ['dark', 'Dark'],
  ['light', 'Light'],
]

/**
 * The resolved light or dark mode the page is showing right now.
 * @param pref The theme preference.
 * @returns The mode the preference resolves to on this device.
 */
function effectiveMode(pref: ThemePreference): Mode {
  if (pref.mode !== 'system') return pref.mode
  const query = '(prefers-color-scheme: dark)'
  return typeof matchMedia === 'function' && matchMedia(query).matches ? 'dark' : 'light'
}

/**
 * Searchable colourway picker. Arrowing through the list previews each palette across the page
 * without saving it. Enter applies the highlighted palette; Escape or closing the picker puts
 * back the palette that was applied before.
 * @param props Whether the picker is open and how to close it.
 * @returns The picker dialog, or nothing while closed.
 */
export function ThemePicker({ open, onClose }: ThemePickerProps) {
  const { preference, setPreference, presets, preview, importCustom, active } = useTheme()
  const dialogRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const listId = useId()
  const [filter, setFilter] = useState<ThemeFilter>({
    query: '',
    appearance: 'all',
    favoritesOnly: false,
    favorites: [],
  })
  const [highlighted, setHighlighted] = useState<string | undefined>(active.id)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)
  const settled = useRef(false)
  const live = useRef({ preference, preview })
  live.current = { preference, preview }

  const swatches = useMemo(
    () => new Map(presets.map((theme) => [theme.id, swatchesOf(theme)])),
    [presets],
  )
  const visible = useMemo(() => filterThemes(presets, filter), [presets, filter])
  const selected = visible.find((theme) => theme.id === highlighted) ?? visible[0]
  const mode = effectiveMode(preference)

  useEffect(() => {
    setFilter((current) => ({ ...current, favorites: loadFavorites() }))
  }, [])

  // Every way of closing the picker lands here: put back the applied palette unless it was
  // applied with Enter. Re-previewing the applied palette is a no-op when nothing was previewed.
  useEffect(() => {
    if (!open) return
    settled.current = false
    setHighlighted(active.id)
    return () => {
      if (settled.current) return
      const { preference: applied, preview: show } = live.current
      show(applied[effectiveMode(applied)])
    }
    // Runs once per opening; `active` is read when the picker opens.
  }, [open])

  useFocusTrap(dialogRef, open, onClose)

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || !selected) return
    const node = document.querySelector(`[data-theme-id="${CSS.escape(selected.id)}"]`)
    node?.scrollIntoView?.({ block: 'nearest' })
  }, [open, selected])

  if (!open) return null

  const highlight = (theme: ThemeDef) => {
    setHighlighted(theme.id)
    preview(theme.id)
  }

  const changeFilter = (next: Partial<ThemeFilter>) => {
    const nextFilter = { ...filter, ...next }
    const list = filterThemes(presets, nextFilter)
    const stillVisible = list.some((theme) => theme.id === highlighted)
    setFilter(nextFilter)
    if (!stillVisible && list[0]) highlight(list[0])
  }

  const step = (direction: 1 | -1) => {
    if (visible.length === 0) return
    const index = visible.findIndex((theme) => theme.id === selected?.id)
    const next = visible[(index + direction + visible.length) % visible.length]
    highlight(next)
  }

  const apply = () => {
    if (!selected) return
    settled.current = true
    setPreference({ ...preference, [mode]: selected.id })
    onClose()
  }

  const chooseMode = (choice: ThemePreference['mode']) => {
    const next = { ...preference, mode: choice }
    setPreference(next)
    setHighlighted(next[effectiveMode(next)])
  }

  const toggleStar = (id: string) => {
    const next = toggleFavorite(filter.favorites, id)
    saveFavorites(next)
    setFilter((current) => ({ ...current, favorites: next }))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target instanceof HTMLTextAreaElement) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      step(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' && !['BUTTON', 'SUMMARY'].includes(target.tagName)) {
      event.preventDefault()
      apply()
    }
  }

  const importPalette = () => {
    try {
      const theme = parseThemeImport(importText)
      importCustom(theme)
      setImportError(null)
      setImportNote(`Imported ${theme.name}. It is now applied.`)
      setImportText('')
      setFilter((current) => ({ ...current, query: '', appearance: 'all', favoritesOnly: false }))
      setHighlighted(theme.id)
    } catch (error) {
      setImportNote(null)
      setImportError(error instanceof Error ? error.message : 'Could not import that theme.')
    }
  }

  const kind = selected?.type === 'terminal' ? 'Terminal palette' : 'Semantic theme'
  const fit = selected ? appearanceOf(selected) : 'both'
  const fitLabel = fit === 'both' ? 'Adapts to light and dark' : fit === 'light' ? 'Light' : 'Dark'

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close theme picker"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-subtle bg-canvas text-primary shadow-[var(--shadow-dialog)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-subtle px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Appearance · {presets.length} palettes
            </p>
            <h2 id={titleId} className="text-lg font-semibold">
              Choose a colourway
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close theme picker"
            className="rounded-lg px-2 py-1 text-muted hover:bg-hover hover:text-primary"
          >
            ×
          </button>
        </header>

        <div className="flex flex-col gap-3 border-b border-subtle px-5 py-3 md:flex-row md:items-center">
          <input
            ref={searchRef}
            type="search"
            aria-label="Search palettes"
            aria-controls={listId}
            placeholder="Search palettes"
            autoComplete="off"
            value={filter.query}
            onChange={(event) => changeFilter({ query: event.target.value })}
            className="min-w-0 flex-1 rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-[var(--focus-ring)] focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div
              role="group"
              aria-label="Filter by appearance"
              className="flex rounded-lg bg-surface p-0.5"
            >
              {appearanceChoices.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter.appearance === value}
                  onClick={() => changeFilter({ appearance: value })}
                  className={`rounded-md px-2.5 py-1 ${
                    filter.appearance === value ? 'bg-raised text-primary' : 'text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={filter.favoritesOnly}
              onClick={() => changeFilter({ favoritesOnly: !filter.favoritesOnly })}
              className={`rounded-lg border border-subtle px-2.5 py-1 ${
                filter.favoritesOnly ? 'text-[var(--status-warning)]' : 'text-muted'
              }`}
            >
              ★ Favorites
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-subtle px-5 py-2 text-sm">
          <span className="text-muted">Mode</span>
          <div role="group" aria-label="Mode" className="flex rounded-lg bg-surface p-0.5">
            {modeChoices.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={preference.mode === value}
                onClick={() => chooseMode(value)}
                className={`rounded-md px-2.5 py-1 ${
                  preference.mode === value ? 'bg-raised text-primary' : 'text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_280px]">
          <div className="flex min-h-0 flex-col">
            <p className="px-5 pb-1 pt-3 text-xs text-muted" aria-live="polite">
              {visible.length} palette{visible.length === 1 ? '' : 's'}
            </p>
            <ul
              id={listId}
              role="listbox"
              aria-label="Palettes"
              className="min-h-[12rem] flex-1 overflow-y-auto px-3 pb-3"
            >
              {visible.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted">
                  No palettes match. Try another search or filter.
                </li>
              )}
              {visible.map((theme) => {
                const isSelected = theme.id === selected?.id
                const isFavorite = filter.favorites.includes(theme.id)
                return (
                  <li
                    key={theme.id}
                    role="option"
                    aria-selected={isSelected}
                    data-theme-id={theme.id}
                    onMouseEnter={() => {
                      if (!isSelected) highlight(theme)
                    }}
                    onClick={() => highlight(theme)}
                    className={`mt-1 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-raised'
                        : 'border-transparent bg-surface hover:bg-hover'
                    }`}
                  >
                    <span className="flex w-24 shrink-0 overflow-hidden rounded-md">
                      {(swatches.get(theme.id) ?? []).slice(0, 6).map((colour, index) => (
                        <i
                          key={index}
                          aria-hidden="true"
                          className="h-4 flex-1"
                          style={{ background: colour }}
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{theme.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted">
                        {theme.id}
                      </span>
                    </span>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
                      aria-pressed={isFavorite}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleStar(theme.id)
                      }}
                      className={`shrink-0 px-1 text-base ${
                        isFavorite ? 'text-[var(--status-warning)]' : 'text-muted'
                      }`}
                    >
                      {isFavorite ? '★' : '☆'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-t border-subtle px-5 py-4 md:border-l md:border-t-0">
            <p className="text-xs uppercase tracking-wide text-muted">Live preview</p>
            {selected ? (
              <>
                <h3 className="text-base font-semibold">{selected.name}</h3>
                <p className="text-xs text-muted">
                  {kind} · {fitLabel}
                </p>
                <div className="flex h-8 overflow-hidden rounded-lg">
                  {(swatches.get(selected.id) ?? []).map((colour, index) => (
                    <i
                      key={index}
                      aria-hidden="true"
                      className="flex-1"
                      style={{ background: colour }}
                    />
                  ))}
                </div>
                <div className="rounded-xl border border-subtle bg-keycap px-4 py-5 text-center font-mono text-lg text-legend">
                  Caps <span className="text-accent-layer-1">→</span> Esc
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Pick a palette to preview it.</p>
            )}

            <details className="mt-auto rounded-xl border border-subtle bg-surface px-3 py-2 text-sm">
              <summary className="cursor-pointer text-secondary">
                Import a Ghostty theme or OpenCode JSON
              </summary>
              <textarea
                aria-label="Theme text to import"
                spellCheck={false}
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="Paste a Ghostty theme file or OpenCode theme JSON…"
                className="mt-2 h-28 w-full resize-y rounded-lg border border-subtle bg-canvas p-2 font-mono text-xs text-primary"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={importPalette}
                  disabled={importText.trim() === ''}
                  className="rounded-lg border border-subtle px-3 py-1.5 text-secondary disabled:opacity-40"
                >
                  Import
                </button>
                <span role="status" className="text-xs">
                  {importError && <span className="text-[var(--status-error)]">{importError}</span>}
                  {importNote && <span className="text-[var(--status-success)]">{importNote}</span>}
                </span>
              </div>
            </details>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle bg-raised px-5 py-3 text-xs text-muted">
          <span>↑ ↓ preview · ↵ apply · esc close</span>
          <button
            type="button"
            onClick={apply}
            disabled={!selected}
            className="rounded-lg bg-accent-layer-1 px-4 py-2 text-sm font-medium text-[var(--on-layer-1)] disabled:opacity-40"
          >
            Use this theme
          </button>
        </footer>
      </div>
    </div>
  )
}
