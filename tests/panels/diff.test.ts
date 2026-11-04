import { describe, expect, it } from 'vitest'
import { countChanges, parseUnifiedDiff } from '../../src/components/panels/diff'

const sample = [
  'diff --git a/base.keymap b/base.keymap',
  '--- a/base.keymap',
  '+++ b/base.keymap',
  '@@ -2,4 +2,4 @@',
  ' first',
  '-second',
  '+second changed',
  ' third',
  '--- a comment that starts with dashes',
  '',
].join('\n')

describe('parseUnifiedDiff', () => {
  it('keeps file headers as meta rows and the hunk header as a hunk row', () => {
    const rows = parseUnifiedDiff(sample)
    expect(rows.slice(0, 4).map((row) => row.kind)).toEqual(['meta', 'meta', 'meta', 'hunk'])
    expect(rows[3].text).toBe('@@ -2,4 +2,4 @@')
  })

  it('numbers context, removed and added lines from the hunk header', () => {
    const body = parseUnifiedDiff(sample).slice(4)
    expect(body[0]).toEqual({ kind: 'context', oldNo: 2, newNo: 2, text: 'first' })
    expect(body[1]).toEqual({ kind: 'remove', oldNo: 3, text: 'second' })
    expect(body[2]).toEqual({ kind: 'add', newNo: 3, text: 'second changed' })
    expect(body[3]).toEqual({ kind: 'context', oldNo: 4, newNo: 4, text: 'third' })
  })

  it('treats a removed line that begins with dashes as a removal, not a header', () => {
    const body = parseUnifiedDiff(sample).slice(8)
    expect(body[0]).toEqual({
      kind: 'remove',
      oldNo: 5,
      text: '-- a comment that starts with dashes',
    })
  })

  it('defaults a missing hunk count to one line', () => {
    const rows = parseUnifiedDiff('@@ -7 +7 @@\n-old\n+new')
    expect(rows.map((row) => [row.kind, row.oldNo ?? null, row.newNo ?? null])).toEqual([
      ['hunk', null, null],
      ['remove', 7, null],
      ['add', null, 7],
    ])
  })

  it('handles CRLF input and a no-newline marker', () => {
    const rows = parseUnifiedDiff('@@ -1 +1 @@\r\n-a\r\n+b\r\n\\ No newline at end of file\r\n')
    expect(rows.map((row) => row.kind)).toEqual(['hunk', 'remove', 'add', 'meta'])
  })

  it('returns no rows for empty input', () => {
    expect(parseUnifiedDiff('')).toEqual([])
  })
})

describe('countChanges', () => {
  it('counts added and removed rows only', () => {
    expect(countChanges(sample)).toEqual({ added: 1, removed: 2 })
  })
})
