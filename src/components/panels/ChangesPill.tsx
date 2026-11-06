export interface ChangesPillProps {
  count: number
  onOpen(): void
}

/**
 * A floating pill at the bottom of the screen that shows how many unsaved keymap changes exist
 * and opens the review sheet. It renders nothing when there are no changes.
 * @param props The change count and open handler.
 * @returns The pill, or nothing when count is zero.
 */
export function ChangesPill({ count, onOpen }: ChangesPillProps) {
  if (count <= 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-subtle bg-raised px-4 py-2 text-sm text-primary shadow-[var(--shadow-float)] hover:bg-hover"
      >
        <span aria-hidden="true" className="size-2 rounded-full bg-[var(--accent-primary)]" />
        <span className="tabular-nums">
          {count} {count === 1 ? 'change' : 'changes'}
        </span>
        <span className="text-muted">·</span>
        <span className="font-medium">Review &amp; commit</span>
      </button>
    </div>
  )
}
