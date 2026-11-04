import type { ReactNode } from 'react'

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

/**
 * Hosts the binding picker next to the key it edits on desktop, or as a bottom sheet on narrow
 * screens. A transparent scrim behind the desktop popover closes it on an outside click.
 * @param props - The key's box, the layout mode and the close handler.
 * @returns The host element.
 */
export function PickerPopover({ anchor, sheet, onClose, children }: PickerPopoverProps) {
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
  // Keys in the lower half open upward, so the popover never runs off the bottom of the screen.
  const vertical =
    anchor && anchor.bottom < viewportHeight / 2
      ? { top: anchor.bottom + GAP }
      : { bottom: anchor ? viewportHeight - anchor.top + GAP : GAP }
  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a binding"
        onMouseDown={(event) => event.stopPropagation()}
        className="fixed max-h-[70dvh] overflow-y-auto rounded-xl border border-subtle bg-raised p-3 shadow-[var(--shadow-float)]"
        style={{ left, width: POPOVER_WIDTH, ...vertical }}
      >
        {children}
      </div>
    </div>
  )
}
