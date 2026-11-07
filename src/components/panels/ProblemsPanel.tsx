import { useState } from 'react'
import type { Issue } from '../../lib/zmk/types'
import { countBySeverity, describeLocation, groupIssues } from './issues'
import type { Severity } from './issues'

/** Props for the problems sidebar. */
export interface ProblemsPanelProps {
  issues: Issue[]
  onJump(issue: Issue): void
}

const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info']

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

const COLLAPSED_KEY = 'adv360.editor.problemsCollapsed'
const WIDE_QUERY = '(min-width: 1024px)'

/**
 * Reads the remembered collapsed state, falling back to a width default: expanded from 1024px.
 * @returns True when the sidebar starts collapsed to its floating button.
 */
function readCollapsed(): boolean {
  // Server render: no window; start expanded and let the client settle it.
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage.getItem(COLLAPSED_KEY)
    if (stored === 'true' || stored === 'false') return stored === 'true'
  } catch {
    // Storage is unavailable, so the width default applies.
  }
  return !window.matchMedia(WIDE_QUERY).matches
}

/**
 * Remembers the collapsed state. Blocked storage is ignored, so the choice is then not kept.
 * @param collapsed - The state to remember.
 */
function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  } catch {
    // Not remembered when storage is blocked.
  }
}

function severityWord(severity: Severity, count: number): string {
  if (severity === 'info') return 'info'
  return count === 1 ? severity : `${severity}s`
}

/**
 * Picks the most serious severity that has at least one problem.
 * @param counts Problem counts per severity.
 * @returns The worst severity present, or null when there are none.
 */
function worstSeverity(counts: Record<Severity, number>): Severity | null {
  return SEVERITIES.find((severity) => counts[severity] > 0) ?? null
}

/**
 * A docked left sidebar listing keymap problems grouped by severity. It can be filtered by
 * severity and collapses to a floating button that shows the count. Each row can jump to the place
 * in the keymap it describes. The sidebar is not modal: the board keeps its keyboard handling.
 * On phones an expanded sidebar overlays the board under the header, with no scrim.
 * @param props The issues to show and the jump handler.
 * @returns The problems sidebar.
 */
export function ProblemsPanel({ issues, onJump }: ProblemsPanelProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [filter, setFilter] = useState<Severity | null>(null)
  const counts = countBySeverity(issues)
  const total = issues.length

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(next)
  }

  if (collapsed) {
    const worst = worstSeverity(counts)
    const tone = worst ? countClass[worst] : 'text-muted'
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={`Show problems (${total})`}
        title="Show problems"
        data-problems-collapsed=""
        className="absolute left-3 top-3 z-20 flex h-7 items-center gap-1.5 rounded-[2px] border border-subtle bg-raised px-2 text-xs text-primary hover:bg-hover"
      >
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={tone}
        >
          {total === 0 ? (
            <path d="M3 8.5l3 3 7-7" />
          ) : (
            <>
              <path d="M8 2.5l6 10.5H2z" />
              <path d="M8 6.5v3" />
              <path d="M8 11.5v.01" />
            </>
          )}
        </svg>
        <span className={`tabular-nums ${tone}`}>{total}</span>
      </button>
    )
  }

  const visible = filter ? issues.filter((item) => item.severity === filter) : issues
  const groups = groupIssues(visible)

  return (
    <aside
      aria-label="Problems"
      className="flex min-h-0 w-[280px] shrink-0 flex-col border-r border-subtle bg-raised text-sm text-primary max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 px-4">
        <h2 className="text-base font-semibold">
          Problems
          <span className="ml-2 text-sm font-normal text-muted">
            {total === 0 ? 'none' : total}
          </span>
        </h2>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Collapse problems"
          className="ml-auto px-2 py-1 text-secondary hover:text-primary"
        >
          <span aria-hidden="true" className="md:hidden">
            ×
          </span>
          <span aria-hidden="true" className="max-md:hidden">
            ‹
          </span>
        </button>
      </div>
      <div
        role="group"
        aria-label="Filter by severity"
        className="flex flex-wrap gap-x-4 gap-y-1 border-b border-subtle px-4 pb-2 text-xs"
      >
        {SEVERITIES.map((severity) => {
          const active = filter === severity
          return (
            <button
              key={severity}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? null : severity)}
              className={`tabular-nums underline-offset-4 hover:underline ${countClass[severity]} ${active ? 'underline' : ''}`}
            >
              {counts[severity]} {severityWord(severity, counts[severity])}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {visible.length === 0 ? (
          <p className="py-3 text-muted">{total === 0 ? 'No problems' : 'None at this severity'}</p>
        ) : (
          groups.map((group) => (
            <div key={group.severity}>
              <h3 className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {group.label} · {group.issues.length}
              </h3>
              <ul className="flex flex-col">
                {group.issues.map((item, index) => {
                  const location = describeLocation(item)
                  return (
                    <li
                      key={`${item.file}:${item.start}:${item.code}:${index}`}
                      className="flex items-start gap-3 border-b border-subtle py-2"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${dotClass[group.severity]}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words leading-snug">{item.message}</p>
                        {location && <p className="break-words text-xs text-muted">{location}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => onJump(item)}
                        aria-label={`Jump to: ${item.message}`}
                        className="shrink-0 text-xs text-secondary hover:text-primary hover:underline"
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
    </aside>
  )
}
