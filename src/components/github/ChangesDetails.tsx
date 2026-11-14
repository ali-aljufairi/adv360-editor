import { countChanges, parseUnifiedDiff } from '../panels/diff'
import type { DiffRow } from '../panels/diff'

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

/** Optional inline summary and diff; no overlay or required form. */
export function ChangesDetails({
  diff,
  summary,
  message,
  onMessage,
  branch,
}: {
  diff: Record<string, string>
  summary: string[]
  message: string
  onMessage(value: string): void
  branch: string
}) {
  return (
    <section
      id="change-details"
      aria-label="Change details"
      className="max-h-72 shrink-0 overflow-y-auto border-t border-subtle px-4 py-3 text-sm"
    >
      <p className="mb-3 text-muted">{branch}</p>
      <label className="mb-3 flex flex-col gap-1">
        <span className="text-muted">Commit message (optional)</span>
        <input
          value={message}
          onChange={(event) => onMessage(event.target.value)}
          className="w-full border-b border-subtle bg-transparent py-1 text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
        />
      </label>
      <ul className="mb-3 flex flex-col gap-1 text-secondary">
        {summary.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        {Object.entries(diff).map(([name, text]) => (
          <DiffFile key={name} name={name} text={text} />
        ))}
      </div>
    </section>
  )
}

function DiffFile({ name, text }: { name: string; text: string }) {
  const rows = parseUnifiedDiff(text)
  const { added, removed } = countChanges(text)
  return (
    <section aria-label={name} className="overflow-hidden rounded-none border border-subtle">
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
