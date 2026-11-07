import type { BuildStatus, CommitResult } from '../../lib/github/types'

/** Props for the build dock. Plain data only. */
export interface BuildPanelProps {
  commit: CommitResult | null
  build: BuildStatus | null
  /** True after polling gave up on the last commit's build. */
  buildTimedOut: boolean
  /** Starts a new polling window for the last commit. */
  onRepoll(): void
}

const FLASH_REMINDER =
  'Flashing is always a manual step — download the .uf2 files and flash each half yourself.'

/**
 * Describes a build run as a label and a status colour.
 * @param build - The build status, or null before a run exists.
 * @returns The label and the CSS colour for the dot.
 */
function runStatus(build: BuildStatus): { label: string; color: string } {
  const run = build.run
  if (!run) return { label: 'Waiting for GitHub to start the build', color: 'var(--status-info)' }
  if (run.status !== 'completed') {
    return run.status === 'in_progress'
      ? { label: 'In progress', color: 'var(--status-warning)' }
      : { label: 'Queued', color: 'var(--status-info)' }
  }
  return run.conclusion === 'success'
    ? { label: 'Succeeded', color: 'var(--status-success)' }
    : { label: `Failed (${run.conclusion ?? 'unknown'})`, color: 'var(--status-error)' }
}

/**
 * The build dock: the last commit, the firmware build run and its downloadable artifacts.
 * @param props - The last commit and the build status.
 * @returns The panel body.
 */
export function BuildPanel({ commit, build, buildTimedOut, onRepoll }: BuildPanelProps) {
  const status = build ? runStatus(build) : null
  const artifacts =
    build?.run?.status === 'completed' && build.run.conclusion === 'success' ? build.artifacts : []
  return (
    <div className="flex flex-col gap-5 px-4 py-4 text-sm">
      {commit ? (
        <section className="flex flex-col gap-1">
          <p>
            Committed{' '}
            <a
              href={commit.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline underline-offset-4"
            >
              {commit.commitSha.slice(0, 7)}
            </a>{' '}
            to <span className="font-mono">{commit.branch}</span>
          </p>
          {commit.backupRef ? (
            <p className="text-muted">Previous version kept as {commit.backupRef}</p>
          ) : null}
        </section>
      ) : null}

      {build && status ? (
        <section className="flex flex-col gap-2">
          <p className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-none"
              style={{ background: status.color }}
            />
            <span>{status.label}</span>
          </p>
          {build.run ? (
            <a
              href={build.run.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="self-start underline underline-offset-4 text-secondary hover:text-primary"
            >
              View run on GitHub
            </a>
          ) : null}
          {artifacts.length > 0 ? (
            <ul className="mt-2 flex flex-col divide-y divide-subtle border-y border-subtle">
              {artifacts.map((artifact) => (
                <li key={artifact.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{artifact.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {(artifact.sizeBytes / 1048576).toFixed(1)} MB
                  </span>
                  {artifact.expired ? (
                    <span className="shrink-0 text-muted">Expired</span>
                  ) : (
                    <a
                      href={artifact.downloadPath}
                      className="shrink-0 underline underline-offset-4 text-secondary hover:text-primary"
                    >
                      Download
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {buildTimedOut ? (
        <section className="flex items-center gap-3">
          <span className="text-[var(--status-warning)]">Stopped checking after 30 minutes</span>
          <button type="button" onClick={onRepoll} className="underline underline-offset-4">
            Check again
          </button>
        </section>
      ) : null}

      <p className="border-t border-subtle pt-4 text-muted">{FLASH_REMINDER}</p>
    </div>
  )
}
