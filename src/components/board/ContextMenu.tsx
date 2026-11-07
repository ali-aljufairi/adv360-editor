import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

/** One row of a context menu. */
export interface ContextMenuItem {
  key: string
  label: string
  /** Shortcut hint shown on the right of the row, already formatted for the platform. */
  shortcut?: string
  disabled?: boolean
  run(): void
}

/** Props for a context menu anchored to a point on screen. */
export interface ContextMenuProps {
  label: string
  /** Viewport pixels of the pointer or the anchor's left edge. */
  x: number
  /** Viewport pixels of the pointer or the anchor's bottom edge. */
  y: number
  items: ContextMenuItem[]
  onClose(): void
}

/** Gap between the menu and the header or viewport edge, in pixels. */
const EDGE = 8

/**
 * A right-click menu in the style of the layer tab menu. It opens below the fixed header,
 * keeps inside the viewport, closes on an outside press, scroll or Escape, and moves between
 * enabled rows with the arrow keys. Choosing a row runs it and closes the menu.
 * @param props - The label, anchor point, rows and close handler.
 * @returns The menu.
 */
export function ContextMenu({ label, x, y, items, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
  )
  // Before paint: clamp the menu inside the viewport and below the header, then focus the first
  // enabled row. Positioning in place (not via state) keeps the menu visible, so it can take focus.
  useLayoutEffect(() => {
    const element = menu.current
    if (!element) return
    const { width, height } = element.getBoundingClientRect()
    const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
    element.style.left = `${Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE))}px`
    element.style.top = `${Math.max(header + EDGE, Math.min(y, window.innerHeight - height - EDGE))}px`
    element.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [x, y])

  // Outside presses, scrolling and resizing close the menu. The anchor is fixed, so a scroll
  // would leave the menu floating away from its key.
  useEffect(() => {
    const closeOnPress = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', closeOnPress)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', closeOnPress)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      // Stop here so the board's Escape (clearing the selection) does not also run.
      event.preventDefault()
      event.stopPropagation()
      opener.current?.focus()
      onClose()
      return
    }
    const enabled = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
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

  // Rendered into the body: the editor shell is an ancestor that offsets `fixed` children.
  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      onKeyDown={handleKey}
      onBlur={(event) => {
        // Tabbing out of the menu closes it.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose()
      }}
      className="fixed z-50 flex min-w-48 flex-col border border-subtle bg-raised p-1"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.run()
            onClose()
          }}
          className="flex items-center justify-between gap-6 px-3 py-1.5 text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span>{item.label}</span>
          {item.shortcut ? (
            <span className="font-mono text-xs text-muted">{item.shortcut}</span>
          ) : null}
        </button>
      ))}
    </div>,
    document.body,
  )
}
