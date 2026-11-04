import { createTwoFilesPatch } from 'diff'
import type { FileMap } from './types'
/** Create unified diffs for changed files. */
export function diff(before: FileMap, after: FileMap): Record<string, string> {
  const result: Record<string, string> = {}
  for (const file of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (before[file] !== after[file])
      result[file] = createTwoFilesPatch(
        `a/${file}`,
        `b/${file}`,
        before[file] ?? '',
        after[file] ?? '',
      )
  return result
}
