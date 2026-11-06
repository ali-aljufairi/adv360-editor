import { useRef, useState, type KeyboardEvent } from 'react'
import { layerAccentOf } from './bindings'

/** One way a layer is reached: a key, combo, or behaviour on another layer. */
export interface LayerAccess {
  kind: 'hold' | 'toggle' | 'switch' | 'once' | 'hold-tap' | 'combo' | 'conditional'
  /** Index of the layer the access starts from, or null when it is not layer-based. */
  fromLayer: number | null
  /** Physical key position that triggers the access, or null for combos. */
  key: number | null
  /** Key positions of a combo, in order. */
  positions?: number[]
  /** Full description, shown as a tooltip on the chip. */
  text: string
}

/** One layer tab. `unreachable` layers get a warning marker and an explanation on hover. */
export interface LayerTab {
  index: number
  name: string
  unreachable: boolean
  access: LayerAccess[]
  /** One-line description of the active layer, e.g. "Toggle on Macro (key 16)". */
  summary: string
}

/** Props for the layer switcher. */
export interface LayerTabsProps {
  layers: LayerTab[]
  /** Index of the selected layer. */
  active: number
  onChange(index: number): void
  /** Adds a layer. The "+ Layer" button is hidden when this is missing. */
  onAdd?(): void
  onRename?(index: number): void
  /** Moves a layer to `to`, a neighbouring index. */
  onMove?(index: number, to: number): void
  onDelete?(index: number): void
}

interface MenuItem {
  key: string
  label: string
  disabled: boolean
  danger?: boolean
  run(): void
}

/** Focuses a menu item as soon as it mounts, so opening the menu lands on its first item. */
function focusOnMount(node: HTMLButtonElement | null) {
  node?.focus()
}

/** Short label for an access chip, e.g. "hold · Base · key 70" or "combo · 46+59". */
function chipLabel(access: LayerAccess, layers: LayerTab[]): string {
  const parts: string[] = [access.kind]
  if (access.fromLayer !== null) {
    const source = layers.find((layer) => layer.index === access.fromLayer)
    parts.push(source?.name ?? `Layer ${access.fromLayer}`)
  }
  if (access.key !== null) parts.push(`key ${access.key}`)
  if (access.positions && access.positions.length > 0) parts.push(access.positions.join('+'))
  return parts.join(' · ')
}

/**
 * Layer tabs with a number badge, colour dot and warning marker per layer, an "+ Layer" button,
 * and an info strip for the active layer with its access chips and a rename/move/delete menu.
 * Arrow keys, Home and End move between tabs and select them, following the WAI-ARIA tabs
 * pattern. Number-key shortcuts belong to the page, not to this component.
 * @param props - The layers, the active index and the optional layer actions.
 * @returns The layer tabs and the active-layer strip.
 */
export function LayerTabs({
  layers,
  active,
  onChange,
  onAdd,
  onRename,
  onMove,
  onDelete,
}: LayerTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const trigger = useRef<HTMLButtonElement>(null)
  const menuWrap = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const position = layers.findIndex((layer) => layer.index === active)
  const current = position >= 0 ? layers[position] : undefined
  const last = layers.length - 1

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, at: number) {
    const targets: Record<string, number> = {
      ArrowRight: at === last ? 0 : at + 1,
      ArrowLeft: at === 0 ? last : at - 1,
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(layers[next].index)
    buttons.current[next]?.focus()
  }

  function closeMenu(restoreFocus: boolean) {
    setMenuOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }

  /** Runs a menu action after closing the menu and returning focus to its trigger. */
  function choose(run: () => void) {
    closeMenu(true)
    run()
  }

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu(true)
      return
    }
    const enabled = Array.from(
      menuWrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    )
    if (enabled.length === 0) return
    const focused = enabled.indexOf(document.activeElement as HTMLButtonElement)
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step !== 0) {
      event.preventDefault()
      const count = enabled.length
      const next = focused < 0 ? (step > 0 ? 0 : count - 1) : (focused + step + count) % count
      enabled[next].focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      enabled[event.key === 'Home' ? 0 : enabled.length - 1].focus()
    }
  }

  const menuItems: MenuItem[] = []
  if (current) {
    const index = current.index
    if (onRename) {
      menuItems.push({
        key: 'rename',
        label: 'Rename',
        disabled: false,
        run: () => onRename(index),
      })
    }
    if (onMove) {
      menuItems.push({
        key: 'left',
        label: 'Move left',
        // Layer 0 is the default layer; layer 1 cannot move in front of it.
        disabled: index <= 1,
        run: () => onMove(index, index - 1),
      })
      menuItems.push({
        key: 'right',
        label: 'Move right',
        disabled: index === 0 || position === last,
        run: () => onMove(index, index + 1),
      })
    }
    if (onDelete) {
      menuItems.push({
        key: 'delete',
        label: 'Delete',
        disabled: index === 0,
        danger: true,
        run: () => onDelete(index),
      })
    }
  }
  const firstEnabledKey = menuItems.find((item) => !item.disabled)?.key

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Layers" className="flex flex-wrap items-center gap-1">
          {layers.map((layer, at) => {
            const selected = layer.index === active
            const accent = `var(--layer-${layerAccentOf(layer.index)})`
            const onAccent = `var(--on-layer-${layerAccentOf(layer.index)})`
            const tipId = `layer-tab-tip-${layer.index}`
            return (
              <div key={layer.index} className="group relative">
                <button
                  ref={(node) => {
                    buttons.current[at] = node
                  }}
                  type="button"
                  role="tab"
                  id={`layer-tab-${layer.index}`}
                  aria-selected={selected}
                  aria-describedby={layer.unreachable ? tipId : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onChange(layer.index)}
                  onKeyDown={(event) => handleKey(event, at)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  style={
                    selected
                      ? {
                          background: accent,
                          color: onAccent,
                          boxShadow: `0 6px 16px -8px ${accent}`,
                        }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  <span
                    aria-hidden="true"
                    className="flex size-5 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                    style={{ background: 'color-mix(in srgb, currentColor 18%, transparent)' }}
                  >
                    {layer.index + 1}
                  </span>
                  {layer.name}
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{
                      background: selected ? onAccent : accent,
                      boxShadow: selected
                        ? 'none'
                        : `0 0 0 3px color-mix(in srgb, ${accent} 22%, transparent)`,
                    }}
                  />
                  {layer.unreachable ? (
                    <span
                      aria-hidden="true"
                      className="size-2 animate-pulse rounded-full"
                      style={{ background: 'var(--status-warning)' }}
                    />
                  ) : null}
                </button>
                {layer.unreachable ? (
                  <span
                    role="tooltip"
                    id={tipId}
                    className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 hidden w-max max-w-56 -translate-x-1/2 rounded-md border px-2 py-1 text-xs group-focus-within:block group-hover:block"
                    style={{
                      background: 'var(--surface-raised)',
                      borderColor: 'var(--status-warning)',
                      color: 'var(--text-primary)',
                      boxShadow: 'var(--shadow-float)',
                    }}
                  >
                    {layer.name} can’t be reached from another layer
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full border border-subtle px-3 py-2 text-sm font-semibold text-secondary hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            + Layer
          </button>
        ) : null}
      </div>

      {current ? (
        <div
          aria-label={`${current.name} layer`}
          role="region"
          className="flex items-start gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 text-sm"
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="min-w-0 font-medium break-words"
              style={current.unreachable ? { color: 'var(--status-warning)' } : undefined}
            >
              {current.summary}
            </span>
            {current.access.map((access, at) => (
              <span
                // Access entries have no id; their order is stable for a given layer.
                key={at}
                title={access.text}
                className="rounded-full border border-subtle px-2 py-0.5 font-mono text-xs text-secondary"
              >
                {chipLabel(access, layers)}
              </span>
            ))}
          </div>
          {menuItems.length > 0 ? (
            <div
              ref={menuWrap}
              className="relative shrink-0"
              onBlur={(event) => {
                // Clicking outside the menu, or tabbing away, closes it.
                if (!menuWrap.current?.contains(event.relatedTarget as Node | null)) {
                  setMenuOpen(false)
                }
              }}
            >
              <button
                ref={trigger}
                type="button"
                aria-label={`Actions for ${current.name}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowDown') return
                  event.preventDefault()
                  setMenuOpen(true)
                }}
                className="rounded-md px-2 py-0.5 text-lg leading-none text-secondary hover:bg-hover focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
              >
                ⋯
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  aria-label={`${current.name} actions`}
                  onKeyDown={handleMenuKey}
                  className="absolute top-full right-0 z-20 mt-1 flex min-w-40 flex-col rounded-md border border-subtle bg-raised p-1 shadow-[var(--shadow-float)]"
                >
                  {menuItems.map((item) => (
                    <button
                      key={item.key}
                      ref={item.key === firstEnabledKey ? focusOnMount : undefined}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => choose(item.run)}
                      className="rounded px-3 py-1.5 text-left hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
                      style={item.danger ? { color: 'var(--status-error)' } : undefined}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
