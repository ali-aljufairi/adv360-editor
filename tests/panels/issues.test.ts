import { describe, expect, it } from 'vitest'
import type { Issue } from '../../src/lib/zmk/types'
import { countBySeverity, describeLocation, groupIssues } from '../../src/components/panels/issues'

function issue(overrides: Partial<Issue>): Issue {
  return {
    file: 'base.keymap',
    start: 0,
    end: 1,
    code: 'unknown-binding',
    severity: 'error',
    message: 'Unknown behavior',
    ...overrides,
  }
}

const issues: Issue[] = [
  issue({ code: 'info-a', severity: 'info', message: 'Layer has no keys set', layer: 1 }),
  issue({ code: 'warn-a', severity: 'warning', message: 'Duplicate combo', start: 40 }),
  issue({ code: 'err-b', message: 'Second error', layer: 2, key: 4, start: 10 }),
  issue({ code: 'err-a', message: 'First error', layer: 0, key: 9, start: 30 }),
  issue({ code: 'err-c', message: 'Error without key', layer: 0, start: 5 }),
  issue({ code: 'err-d', message: 'Error on key 3', layer: 0, key: 3, start: 50 }),
]

describe('groupIssues', () => {
  it('orders groups error, warning, info and omits empty severities', () => {
    const groups = groupIssues(issues)
    expect(groups.map((group) => group.severity)).toEqual(['error', 'warning', 'info'])
    expect(groups.map((group) => group.label)).toEqual(['Errors', 'Warnings', 'Info'])
    expect(groupIssues(issues.filter((item) => item.severity === 'info'))).toHaveLength(1)
  })

  it('sorts within a group by layer, then key, then position, with unlocated issues last', () => {
    const errors = groupIssues(issues)[0].issues.map((item) => item.code)
    expect(errors).toEqual(['err-d', 'err-a', 'err-c', 'err-b'])
  })

  it('does not modify the input array', () => {
    const before = issues.map((item) => item.code)
    groupIssues(issues)
    expect(issues.map((item) => item.code)).toEqual(before)
  })

  it('returns no groups for no issues', () => {
    expect(groupIssues([])).toEqual([])
  })
})

describe('countBySeverity', () => {
  it('counts every severity, including zeros', () => {
    expect(countBySeverity(issues)).toEqual({ error: 4, warning: 1, info: 1 })
    expect(countBySeverity([])).toEqual({ error: 0, warning: 0, info: 0 })
  })
})

describe('describeLocation', () => {
  it('describes layer and key when both are known', () => {
    expect(describeLocation(issue({ layer: 2, key: 14 }))).toBe('Layer 2 · key 14')
  })

  it('describes only what is known and is empty otherwise', () => {
    expect(describeLocation(issue({ key: 3 }))).toBe('key 3')
    expect(describeLocation(issue({}))).toBe('')
  })
})
