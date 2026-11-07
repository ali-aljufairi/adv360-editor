import { useEffect, useState, type ReactNode } from 'react'

/** Props for the container that hosts the binding picker. */
export interface PickerPopoverProps {
  /** The activated key's box in viewport pixels; null when it cannot be measured. */
  anchor: { top: number; bottom: number; left: number } | null
  /** Use a bottom sheet instead of a popover next to the key. */
  sheet: boolean
  onClose(): void
  children: ReactNode
}

/** Width of the desktop popover, in pixels. */
const POPOVER_WIDTH = 420
/** Gap between the key and the popover, in pixels. */
const GAP = 8
/** Smallest height the popover may shrink to before it is allowed to overlap the key. */
const MIN_POPOVER_HEIGHT = 280

/**
 * Hosts the binding picker next to the key it edits on desktop, or as a bottom sheet on narrow
 * screens. A transparent scrim behind the desktop popover closes it on an outside click.
 * @param props - The key's box, the layout mode and the close handler.
 * @returns The host element.
 */
export function PickerPopover({ anchor, sheet, onClose, children }: PickerPopoverProps) {
  // Read during the first render, before the picker moves focus into its search field.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
  )
  // Closing removes the picker, which drops focus to the body. Return it to the key that opened
  // the picker, unless focus has already moved somewhere deliberate.
  useEffect(
    () => () => {
      const active = document.activeElement
      if (opener?.isConnected && (!active || active === document.body)) opener.focus()
    },
    [opener],
  )
  if (sheet) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a binding"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-subtle bg-raised p-3 shadow-[var(--shadow-float)]"
        >
          {children}
        </div>
      </div>
    )
  }
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight
  const left = anchor
    ? Math.min(Math.max(anchor.left, GAP), viewportWidth - POPOVER_WIDTH - GAP)
    : (viewportWidth - POPOVER_WIDTH) / 2
  // Open on the side of the key with more room, and cap the height to that room so the popover
  // (and its search field) never runs off the top or bottom of the screen.
  const spaceBelow = anchor ? viewportHeight - anchor.bottom - 2 * GAP : viewportHeight - 2 * GAP
  const spaceAbove = anchor ? anchor.top - 2 * GAP : 0
  const openBelow = !anchor || spaceBelow >= spaceAbove
  const maxHeight = Math.max(
    MIN_POPOVER_HEIGHT,
    Math.min(openBelow ? spaceBelow : spaceAbove, viewportHeight * 0.7),
  )
  const vertical = openBelow
    ? { top: anchor ? anchor.bottom + GAP : GAP, maxHeight }
    : { bottom: viewportHeight - anchor.top + GAP, maxHeight }
  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a binding"
        onMouseDown={(event) => event.stopPropagation()}
        className="fixed overflow-y-auto rounded-xl border border-subtle bg-raised p-3 shadow-[var(--shadow-float)]"
        style={{ left, width: POPOVER_WIDTH, ...vertical }}
      >
        {children}
      </div>
    </div>
  )
}
