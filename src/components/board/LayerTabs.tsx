import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
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

/** The open actions menu: the layer it belongs to and the position of its tab. */
interface OpenMenu {
  index: number
  at: number
}

/** Focuses a menu item as soon as it mounts, so opening the menu lands on its first item. */
function focusOnMount(node: HTMLButtonElement | null) {
  node?.focus()
}

/**
 * Layer tabs in the WAI-ARIA tabs pattern: a colour dot per layer, an underline on the active
 * tab and a warning marker on unreachable layers. Right-clicking a tab (or pressing ArrowDown on
 * it) opens its rename, move and delete actions, and double-clicking it renames the layer. A
 * plain "+ Layer" text button ends the row. Number-key shortcuts belong to the page.
 * @param props - The layers, the active index and the optional layer actions.
 * @returns The layer tab row.
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
  const menuRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const last = layers.length - 1

  // A pointer press anywhere outside the open menu closes it.
  useEffect(() => {
    if (menu === null) return undefined
    function closeOnPress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    document.addEventListener('pointerdown', closeOnPress)
    return () => document.removeEventListener('pointerdown', closeOnPress)
  }, [menu])

  /** The actions for a tab, with the same disabled rules as before. */
  function itemsFor(layer: LayerTab, at: number): MenuItem[] {
    const index = layer.index
    const items: MenuItem[] = []
    if (onRename) {
      items.push({
        key: 'rename',
        label: 'Rename',
        disabled: false,
        run: () => onRename(index),
      })
    }
    if (onMove) {
      items.push({
        key: 'left',
        label: 'Move left',
        // Layer 0 is the default layer; layer 1 cannot move in front of it.
        disabled: index <= 1,
        run: () => onMove(index, index - 1),
      })
      items.push({
        key: 'right',
        label: 'Move right',
        disabled: index === 0 || at === last,
        run: () => onMove(index, index + 1),
      })
    }
    if (onDelete) {
      items.push({
        key: 'delete',
        label: 'Delete',
        disabled: index === 0,
        danger: true,
        run: () => onDelete(index),
      })
    }
    return items
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, at: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const layer = layers[at]
      if (itemsFor(layer, at).length > 0) setMenu({ index: layer.index, at })
      return
    }
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

  /** Closes the menu, optionally returning focus to the tab it was opened from. */
  function closeMenu(restoreFocus: boolean) {
    const at = menu?.at
    setMenu(null)
    if (restoreFocus && at !== undefined) buttons.current[at]?.focus()
  }

  /** Runs a menu action after closing the menu and returning focus to its tab. */
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
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
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

  return (
    <div className="flex w-full flex-wrap items-stretch border-b border-subtle">
      <div role="tablist" aria-label="Layers" className="flex flex-wrap items-stretch">
        {layers.map((layer, at) => {
          const selected = layer.index === active
          const accent = `var(--layer-${layerAccentOf(layer.index)})`
          const tipId = `layer-tab-tip-${layer.index}`
          const items = menu?.index === layer.index ? itemsFor(layer, at) : []
          const firstEnabled = items.findIndex((item) => !item.disabled)
          return (
            <div key={layer.index} className="group relative flex">
              <button
                ref={(node) => {
                  buttons.current[at] = node
                }}
                type="button"
                role="tab"
                id={`layer-tab-${layer.index}`}
                title={layer.summary}
                aria-selected={selected}
                aria-describedby={layer.unreachable ? tipId : undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(layer.index)}
                onDoubleClick={() => onRename?.(layer.index)}
                onContextMenu={(event: MouseEvent<HTMLButtonElement>) => {
                  if (itemsFor(layer, at).length === 0) return
                  event.preventDefault()
                  setMenu({ index: layer.index, at })
                }}
                onKeyDown={(event) => handleKey(event, at)}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${
                  selected
                    ? 'font-semibold text-[var(--text-primary)]'
                    : 'font-medium text-secondary hover:text-[var(--text-primary)]'
                }`}
                style={{ borderBottomColor: selected ? accent : 'transparent' }}
              >
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: accent }}
                />
                {layer.name}
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
                  className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 hidden w-max max-w-56 -translate-x-1/2 border px-2 py-1 text-xs group-focus-within:block group-hover:block"
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
              {items.length > 0 ? (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label={`${layer.name} actions`}
                  onKeyDown={handleMenuKey}
                  onBlur={(event) => {
                    // Tabbing out of the menu closes it.
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setMenu(null)
                    }
                  }}
                  className="absolute top-full left-0 z-20 mt-1 flex min-w-40 flex-col border border-subtle bg-raised p-1"
                >
                  {items.map((item, itemAt) => (
                    <button
                      key={item.key}
                      ref={itemAt === firstEnabled ? focusOnMount : undefined}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => choose(item.run)}
                      className="px-3 py-1.5 text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
                      style={item.danger ? { color: 'var(--status-error)' } : undefined}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="ml-auto px-3 py-2 text-sm font-semibold text-secondary hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          + Layer
        </button>
      ) : null}
    </div>
  )
}
