import { useId, useRef, useState } from 'react'
import { countChanges, parseUnifiedDiff } from './diff'
import type { DiffRow } from './diff'
import { useFocusTrap } from './useFocusTrap'

export interface ChangesSheetProps {
  diff: Record<string, string>
  summary: string[] // human-readable lines, e.g. "Base · key 12: Caps → Esc"
  onClose(): void
  onDiscard(): void
}

type Tab = 'summary' | 'diff'

const rowClass: Record<DiffRow['kind'], string> = {
  add: 'bg-[var(--diff-add-bg)] text-[var(--diff-add)]',
  remove: 'bg-[var(--diff-remove-bg)] text-[var(--diff-remove)]',
  context: 'text-secondary',
  hunk: 'bg-hover text-muted',
  meta: 'text-muted',
}

const markerOf: Record<DiffRow['kind'], string> = {
  add: '+',
  remove: '−',
  context: ' ',
  hunk: '',
  meta: '',
}

/**
 * A review sheet for unsaved keymap changes. It has a plain-language summary and a per-file
 * unified diff, with discard and (for now disabled) commit and build actions.
 * @param props The diff per file, summary lines and close and discard handlers.
 * @returns The sheet.
 */
export function ChangesSheet({ diff, summary, onClose, onDiscard }: ChangesSheetProps) {
  const [tab, setTab] = useState<Tab>('summary')
  const [confirming, setConfirming] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(sheetRef, true, onClose)
  const files = Object.entries(diff)
  const count = summary.length
  const tabs: Array<[Tab, string]> = [
    ['summary', 'Summary'],
    ['diff', 'Diff'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] backdrop-blur-sm sm:items-center">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close review"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-2xl border border-subtle bg-canvas text-primary shadow-[var(--shadow-dialog)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-subtle px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Review</p>
            <h2 id={titleId} className="text-lg font-semibold">
              {count} unsaved {count === 1 ? 'change' : 'changes'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review"
            className="rounded-lg px-2 py-1 text-muted hover:bg-hover hover:text-primary"
          >
            ×
          </button>
        </header>

        <div role="tablist" aria-label="Review views" className="flex gap-1 px-5 pt-3">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === id ? 'bg-raised font-medium text-primary' : 'text-muted hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === 'summary' ? (
            summary.length === 0 ? (
              <p className="text-muted">Nothing has changed yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {summary.map((line, index) => (
                  <li key={`${index}:${line}`} className="rounded-lg bg-surface px-3 py-2">
                    {line}
                  </li>
                ))}
              </ul>
            )
          ) : files.length === 0 ? (
            <p className="text-muted">No file differences to show.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {files.map(([file, text]) => (
                <DiffFile key={file} name={file} text={text} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-subtle px-5 py-4">
          <p className="mb-3 rounded-lg bg-surface px-3 py-2 text-sm text-secondary">
            <strong className="text-primary">Building never flashes your keyboard.</strong> Building
            only produces a firmware file. Your keyboard keeps its current layout until you flash it
            yourself.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {confirming ? (
              <div className="flex items-center gap-2 text-sm">
                <span>
                  Discard {count} {count === 1 ? 'change' : 'changes'}?
                </span>
                <button
                  type="button"
                  onClick={onDiscard}
                  className="rounded-lg bg-[var(--status-error)] px-3 py-1.5 font-medium text-[var(--on-accent)]"
                >
                  Discard all
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-subtle px-3 py-1.5 text-secondary hover:text-primary"
                >
                  Keep editing
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={count === 0}
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--status-error)] hover:bg-hover disabled:opacity-40"
              >
                Discard all
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                title="Coming in M4"
                className="rounded-lg border border-subtle px-3 py-1.5 text-sm text-muted disabled:cursor-not-allowed"
              >
                Commit…
              </button>
              <button
                type="button"
                disabled
                title="Coming in M4"
                className="rounded-lg bg-accent-layer-1 px-3 py-1.5 text-sm font-medium text-[var(--on-layer-1)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Build
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DiffFile({ name, text }: { name: string; text: string }) {
  const rows = parseUnifiedDiff(text)
  const { added, removed } = countChanges(text)
  return (
    <section aria-label={name} className="overflow-hidden rounded-xl border border-subtle">
      <header className="flex items-center justify-between gap-3 bg-surface px-3 py-2 font-mono text-xs">
        <span className="truncate text-primary">{name}</span>
        <span className="shrink-0 tabular-nums">
          <span className="text-[var(--diff-add)]">+{added}</span>{' '}
          <span className="text-[var(--diff-remove)]">−{removed}</span>
        </span>
      </header>
      <div className="overflow-x-auto font-mono text-xs leading-5">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={rowClass[row.kind]}>
                <td className="w-10 select-none px-2 text-right align-top text-muted tabular-nums">
                  {row.oldNo ?? ''}
                </td>
                <td className="w-10 select-none px-2 text-right align-top text-muted tabular-nums">
                  {row.newNo ?? ''}
                </td>
                <td className="w-4 select-none align-top">{markerOf[row.kind]}</td>
                <td className="whitespace-pre pr-3 align-top">{row.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
