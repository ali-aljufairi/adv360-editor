import { describe, expect, it } from 'vitest'
import { issueKeysFor } from '../../src/components/panels/issues'
import type { Issue } from '../../src/lib/zmk/types'

function issue(overrides: Partial<Issue>): Issue {
  return {
    file: 'base.keymap',
    start: 0,
    end: 1,
    code: 'test',
    severity: 'warning',
    message: 'message',
    ...overrides,
  }
}

describe('issueKeysFor', () => {
  it('maps the problems of one layer to their physical keys', () => {
    const map = issueKeysFor(
      [
        issue({ layer: 0, key: 12, severity: 'error', message: 'bad behaviour' }),
        issue({ layer: 2, key: 30, severity: 'warning', message: 'other layer' }),
      ],
      0,
    )
    expect([...map.keys()]).toEqual([12])
    expect(map.get(12)).toEqual({ severity: 'error', messages: ['bad behaviour'] })
  })

  it('gives a key the most serious severity and keeps every message, most serious first', () => {
    const map = issueKeysFor(
      [
        issue({ layer: 0, key: 4, severity: 'info', message: 'note' }),
        issue({ layer: 0, key: 4, severity: 'warning', message: 'warn one' }),
        issue({ layer: 0, key: 4, severity: 'error', message: 'error' }),
        issue({ layer: 0, key: 4, severity: 'warning', message: 'warn two' }),
      ],
      0,
    )
    expect(map.get(4)).toEqual({
      severity: 'error',
      messages: ['error', 'warn one', 'warn two', 'note'],
    })
  })

  it('leaves out problems that have no key', () => {
    const map = issueKeysFor([issue({ layer: 0, severity: 'error' })], 0)
    expect(map.size).toBe(0)
  })

  it('resolves the layer with the caller’s resolver when the issue has none', () => {
    const map = issueKeysFor([issue({ key: 7, severity: 'error', start: 40 })], 3, (item) =>
      item.start === 40 ? 3 : -1,
    )
    expect(map.get(7)?.severity).toBe('error')
  })

  it('does not change its input', () => {
    const input = [issue({ layer: 0, key: 1 }), issue({ layer: 0, key: 1, severity: 'error' })]
    const copy = structuredClone(input)
    issueKeysFor(input, 0)
    expect(input).toEqual(copy)
  })
})
