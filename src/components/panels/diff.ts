/** One renderable row of a unified diff. */
export interface DiffRow {
  kind: 'add' | 'remove' | 'context' | 'hunk' | 'meta'
  /** Line number in the old file, when the row exists there. */
  oldNo?: number
  /** Line number in the new file, when the row exists there. */
  newNo?: number
  /** Line text without its +/-/space marker. Hunk and meta rows keep their full text. */
  text: string
}

const HUNK_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/**
 * Parse a unified diff into rows with old and new line numbers.
 *
 * File headers (`diff --git`, `---`, `+++`, `index`) before a hunk are kept as meta rows.
 * Hunk bodies are counted with the header's line counts, so a removed line that starts with
 * `--` is still treated as a removal rather than a file header.
 * @param text Unified diff text for one file.
 * @returns Rows in source order.
 */
export function parseUnifiedDiff(text: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldNo = 0
  let newNo = 0
  let oldLeft = 0
  let newLeft = 0
  for (const line of text.split(/\r?\n/)) {
    if (oldLeft === 0 && newLeft === 0) {
      const hunk = HUNK_PATTERN.exec(line)
      if (hunk) {
        oldNo = Number(hunk[1])
        newNo = Number(hunk[3])
        oldLeft = hunk[2] === undefined ? 1 : Number(hunk[2])
        newLeft = hunk[4] === undefined ? 1 : Number(hunk[4])
        rows.push({ kind: 'hunk', text: line })
      } else if (line.length > 0) {
        rows.push({ kind: 'meta', text: line })
      }
      continue
    }
    const marker = line.charAt(0)
    if (marker === '+') {
      rows.push({ kind: 'add', newNo, text: line.slice(1) })
      newNo += 1
      newLeft -= 1
    } else if (marker === '-') {
      rows.push({ kind: 'remove', oldNo, text: line.slice(1) })
      oldNo += 1
      oldLeft -= 1
    } else if (marker === '\\') {
      rows.push({ kind: 'meta', text: line })
    } else {
      rows.push({ kind: 'context', oldNo, newNo, text: line.slice(1) })
      oldNo += 1
      newNo += 1
      oldLeft -= 1
      newLeft -= 1
    }
    oldLeft = Math.max(0, oldLeft)
    newLeft = Math.max(0, newLeft)
  }
  return rows
}

/**
 * Count added and removed lines in a unified diff.
 * @param text Unified diff text for one file.
 * @returns The number of added and removed rows.
 */
export function countChanges(text: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const row of parseUnifiedDiff(text)) {
    if (row.kind === 'add') added += 1
    if (row.kind === 'remove') removed += 1
  }
  return { added, removed }
}
