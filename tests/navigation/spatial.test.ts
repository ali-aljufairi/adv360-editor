import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadPhysicalLayout } from '../../src/lib/zmk/layout'
import type { PhysicalKey } from '../../src/lib/zmk/types'
import {
  type Direction,
  keyCenter,
  first,
  last,
  nextKey,
  orderNext,
  orderPrev,
  rankCandidates,
  rowEnd,
  rowStart,
} from '../../src/lib/navigation/spatial'

const keys = loadPhysicalLayout(readFileSync('fixtures/adv360/info.json', 'utf8'))
const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down']

/** Position in `keys` of the key with `label` and optional occurrence (0-based). */
function at(label: string, occurrence = 0): number {
  const matches = keys.filter((key) => key.label === label)
  const found: PhysicalKey | undefined = matches[occurrence]
  if (!found) throw new Error(`no key ${label}#${occurrence}`)
  return found.index
}

/** Breadth-first reachability over single-step moves. */
function reachableFrom(start: number): Set<number> {
  const seen = new Set<number>([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const dir of DIRECTIONS) {
      const next = nextKey(keys, current, dir)
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

describe('spatial moves on the Advantage360 layout', () => {
  it('loads all 76 physical keys in binding order', () => {
    expect(keys).toHaveLength(76)
    expect(keys.map((key) => key.index)).toEqual(keys.map((_, position) => position))
  })

  it('moves right from left Shift to Z', () => {
    expect(keys[nextKey(keys, at('LShift'), 'right')]!.label).toBe('Z')
  })

  it('moves right from the inner top key of the left half into the right half', () => {
    const innerTop = at('mod1')
    const target = nextKey(keys, innerTop, 'right')
    expect(keys[target]!.label).toBe('mod2')
    expect(keys[target]!.x).toBeGreaterThan(10)
  })

  it('moves down and up along a column', () => {
    expect(keys[nextKey(keys, at('Q'), 'down')]!.label).toBe('A')
    expect(keys[nextKey(keys, at('A'), 'up')]!.label).toBe('Q')
  })

  it('prefers the same row for left and right moves', () => {
    expect(keys[nextKey(keys, at('A'), 'right')]!.label).toBe('S')
    expect(keys[nextKey(keys, at('J'), 'left')]!.label).toBe('H')
  })

  it('stays put at a true edge without wrapping', () => {
    const rightmostRowThree = at('RShift')
    expect(nextKey(keys, rightmostRowThree, 'right')).toBe(rightmostRowThree)
    expect(nextKey(keys, at('='), 'left')).toBe(at('='))
  })

  it('wraps to the far key of the same row when wrap is enabled', () => {
    const wrapped = nextKey(keys, at('RShift'), 'right', { wrap: true })
    expect(keys[wrapped]!.label).toBe('LShift')
  })

  it('returns -1 for an empty board and starts at key 0 for an invalid origin', () => {
    expect(nextKey([], 0, 'left')).toBe(-1)
    expect(nextKey(keys, -1, 'down')).toBe(0)
  })

  it('uses the rotated centre for thumb keys', () => {
    const lctrl = keys[at('LCtrl')]!
    const center = keyCenter(lctrl)
    expect(center.cx).toBeCloseTo(7.05, 2)
    expect(center.cy).toBeCloseTo(5.0, 2)
  })
})

describe('thumb clusters', () => {
  const thumbs = keys.filter((key) => key.r !== 0)

  it('every move from a thumb key is a different valid key or a true edge', () => {
    for (const thumb of thumbs) {
      for (const dir of DIRECTIONS) {
        const next = nextKey(keys, thumb.index, dir)
        if (next === thumb.index) {
          expect(rankCandidates(keys, thumb.index, dir)).toEqual([])
        } else {
          expect(next).toBeGreaterThanOrEqual(0)
          expect(next).toBeLessThan(keys.length)
          expect(rankCandidates(keys, thumb.index, dir)[0]).toBe(next)
        }
      }
    }
  })

  it('every thumb cluster is entered from the main block and every thumb key can get back', () => {
    const isMain = (position: number) => keys[position]!.r === 0
    const mainKeys = keys.filter((key) => isMain(key.index)).map((key) => key.index)
    const enteredFromMain = new Set<number>()
    for (const position of mainKeys) {
      for (const dir of DIRECTIONS) {
        const next = nextKey(keys, position, dir)
        if (!isMain(next)) enteredFromMain.add(next)
      }
    }
    for (const thumb of thumbs) {
      expect(enteredFromMain.size, 'some thumb key is entered directly').toBeGreaterThan(0)
      expect(reachableFrom(thumb.index).has(mainKeys[0]!), `leave ${thumb.label}`).toBe(true)
    }
    // Every thumb key must be reachable from the main block, not only from its neighbours.
    const fromMainBlock = new Set<number>()
    for (const position of mainKeys) {
      for (const reached of reachableFrom(position)) fromMainBlock.add(reached)
    }
    for (const thumb of thumbs) expect(fromMainBlock.has(thumb.index), thumb.label).toBe(true)
  })
})

describe('graph connectivity', () => {
  it('every key can reach every other key through single moves', () => {
    const all = keys.map((key) => key.index)
    for (const start of all) {
      const reached = reachableFrom(start)
      expect(reached.size, `from ${keys[start]!.label}`).toBe(keys.length)
    }
  })
})

describe('order and row helpers', () => {
  it('walks binding order and stops at the ends unless wrapping', () => {
    expect(first(keys)).toBe(0)
    expect(last(keys)).toBe(keys.length - 1)
    expect(orderNext(keys, 0)).toBe(1)
    expect(orderPrev(keys, 1)).toBe(0)
    expect(orderPrev(keys, 0)).toBe(0)
    expect(orderNext(keys, keys.length - 1)).toBe(keys.length - 1)
    expect(orderNext(keys, keys.length - 1, { wrap: true })).toBe(0)
    expect(orderPrev(keys, 0, { wrap: true })).toBe(keys.length - 1)
  })

  it('finds the start and end of a row', () => {
    expect(keys[rowStart(keys, at('K'))]!.label).toBe('Caps')
    expect(keys[rowEnd(keys, at('K'))]!.label).toBe("'")
  })
})
