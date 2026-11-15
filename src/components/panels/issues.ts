import type { Issue } from '../../lib/zmk/types'

export type Severity = Issue['severity']

/** Severities in display order, most serious first. */
export const severityOrder: readonly Severity[] = ['error', 'warning', 'info']

/** A severity bucket with its issues sorted by location. */
export interface IssueGroup {
  severity: Severity
  label: string
  issues: Issue[]
}

const severityLabels: Record<Severity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
}

/**
 * Compare two issues by file, then layer, key and position. Issues without a layer or key sort
 * after those that have one.
 * @param left First issue.
 * @param right Second issue.
 * @returns A negative, zero or positive number, as for Array.prototype.sort.
 */
export function compareIssues(left: Issue, right: Issue): number {
  const fileOrder = left.file.localeCompare(right.file)
  if (fileOrder !== 0) return fileOrder
  const layerOrder = compareOptional(left.layer, right.layer)
  if (layerOrder !== 0) return layerOrder
  const keyOrder = compareOptional(left.key, right.key)
  if (keyOrder !== 0) return keyOrder
  return left.start - right.start || left.code.localeCompare(right.code)
}

function compareOptional(left?: number, right?: number): number {
  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left - right
}

/**
 * Group issues by severity, errors first. Empty severities are omitted.
 * @param issues Issues to group. The input is not modified.
 * @returns Non-empty groups in severity order, each sorted by location.
 */
export function groupIssues(issues: readonly Issue[]): IssueGroup[] {
  return severityOrder.flatMap((severity) => {
    const matching = issues.filter((issue) => issue.severity === severity).sort(compareIssues)
    return matching.length === 0
      ? []
      : [{ severity, label: severityLabels[severity], issues: matching }]
  })
}

/**
 * Count issues per severity, including zero counts.
 * @param issues Issues to count.
 * @returns A count for every severity.
 */
export function countBySeverity(issues: readonly Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 }
  for (const issue of issues) counts[issue.severity] += 1
  return counts
}

/**
 * Describe where an issue is, in words a person can scan.
 * @param issue The issue to describe.
 * @returns A short location such as "Layer 2 · key 14", or an empty string.
 */
export function describeLocation(issue: Issue): string {
  const parts: string[] = []
  if (issue.layer !== undefined) parts.push(`Layer ${issue.layer}`)
  if (issue.key !== undefined) parts.push(`key ${issue.key}`)
  return parts.join(' · ')
}

/** The problems attached to one physical key on the shown layer. */
export interface KeyIssue {
  /** The most serious severity among the key's problems. */
  severity: Severity
  /** Every problem message for the key, most serious first. */
  messages: string[]
}

/**
 * Map the problems on one layer to the keys they are attached to. Problems without a key, and
 * problems on other layers, are left out. A key with several problems takes the most serious
 * severity, and keeps all of its messages.
 * @param issues Issues to map. The input is not modified.
 * @param layer Index of the layer on screen.
 * @param layerOf Resolves an issue's layer index. Defaults to the issue's own `layer` field.
 * @returns Keys mapped to their problems, keyed by physical key index.
 */
export function issueKeysFor(
  issues: readonly Issue[],
  layer: number,
  layerOf: (issue: Issue) => number = (issue) => issue.layer ?? -1,
): Map<number, KeyIssue> {
  const byKey = new Map<number, Issue[]>()
  for (const issue of issues) {
    if (issue.key === undefined || layerOf(issue) !== layer) continue
    const list = byKey.get(issue.key) ?? []
    list.push(issue)
    byKey.set(issue.key, list)
  }
  const mapped = new Map<number, KeyIssue>()
  for (const [key, list] of byKey) {
    const sorted = [...list].sort(
      (left, right) => severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity),
    )
    mapped.set(key, { severity: sorted[0].severity, messages: sorted.map((item) => item.message) })
  }
  return mapped
}
