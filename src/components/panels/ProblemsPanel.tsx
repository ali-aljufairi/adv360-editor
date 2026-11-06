import { useState } from 'react'
import type { Issue } from '../../lib/zmk/types'
import { countBySeverity, describeLocation, groupIssues } from './issues'
import type { Severity } from './issues'

export interface ProblemsPanelProps {
  issues: Issue[]
  onJump(issue: Issue): void
}

const dotClass: Record<Severity, string> = {
  error: 'bg-[var(--status-error)]',
  warning: 'bg-[var(--status-warning)]',
  info: 'bg-[var(--status-info)]',
}

const countClass: Record<Severity, string> = {
  error: 'text-[var(--status-error)]',
  warning: 'text-[var(--status-warning)]',
  info: 'text-[var(--status-info)]',
}

function severityWord(severity: Severity, count: number): string {
  if (severity === 'info') return 'info'
  return count === 1 ? severity : `${severity}s`
}

/**
 * A compact, collapsible list of keymap problems grouped by severity. Each row can jump to the
 * place in the keymap it describes.
 * @param props The issues to show and the jump handler.
 * @returns The problems panel.
 */
export function ProblemsPanel({ issues, onJump }: ProblemsPanelProps) {
  const [open, setOpen] = useState(true)
  const groups = groupIssues(issues)
  const counts = countBySeverity(issues)
  const total = issues.length
  return (
    <section
      aria-label="Problems"
      className="rounded-2xl border border-subtle bg-surface text-sm text-primary"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-semibold">
          Problems
          <span className="ml-2 font-normal text-muted">{total === 0 ? 'none' : total}</span>
        </span>
        <span className="flex items-center gap-3 text-xs">
          {(['error', 'warning', 'info'] as const).map((severity) => (
            <span key={severity} className={`tabular-nums ${countClass[severity]}`}>
              {counts[severity]} {severityWord(severity, counts[severity])}
            </span>
          ))}
          <span aria-hidden="true" className="text-muted">
            {open ? '▾' : '▸'}
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-subtle px-2 pb-2 pt-1">
          {total === 0 ? (
            <p className="px-2 py-3 text-muted">No problems</p>
          ) : (
            groups.map((group) => (
              <div key={group.severity} className="mt-1">
                <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.label} · {group.issues.length}
                </h3>
                <ul className="flex flex-col">
                  {group.issues.map((item, index) => {
                    const location = describeLocation(item)
                    return (
                      <li
                        key={`${item.file}:${item.start}:${item.code}:${index}`}
                        className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-hover"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${dotClass[group.severity]}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="leading-snug">{item.message}</p>
                          {location && <p className="text-xs text-muted">{location}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => onJump(item)}
                          aria-label={`Jump to: ${item.message}`}
                          className="shrink-0 rounded-md border border-subtle px-2 py-0.5 text-xs text-secondary hover:text-primary"
                        >
                          Jump
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
