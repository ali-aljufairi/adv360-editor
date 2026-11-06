import type { FocusEvent, KeyboardEvent, ReactNode } from 'react'

/** Props for a docked side panel. */
export interface SidePanelProps {
  title: string
  onClose(): void
  children: ReactNode
}

/**
 * A docked column beside the board, under the header. It is not modal: there is no scrim and no
 * focus trap, and it stays open until its × button is pressed. Escape closes it only while focus
 * is inside the panel.
 * @param props - Title, close handler and content.
 * @returns The panel column.
 */
export function SidePanel({ title, onClose, children }: SidePanelProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    onClose()
  }
  return (
    <aside
      aria-label={title}
      onKeyDown={onKeyDown}
      className="z-20 flex min-h-0 flex-col border-l border-subtle bg-raised text-primary max-md:absolute max-md:inset-0 md:static md:w-[420px] md:shrink-0"
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-subtle px-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
          className="ml-auto px-2 py-1 text-secondary hover:text-primary"
        >
          ×
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  )
}

/**
 * Tells whether focus moved out of a panel, so the board can resume keyboard handling.
 * @param event - The blur event from the panel wrapper.
 * @returns True while focus is still inside the wrapper.
 */
export function focusStaysInside(event: FocusEvent<HTMLElement>): boolean {
  return event.currentTarget.contains(event.relatedTarget as Node | null)
}
