import { describe, expect, it } from 'vitest'
import {
  arcPath,
  boardBounds,
  comboSegments,
  keyBox,
  keyCenter,
  rotatePoint,
} from '../../src/components/board/geometry'
import type { PhysicalKey } from '../../src/lib/zmk/types'

function key(index: number, values: Partial<PhysicalKey> = {}): PhysicalKey {
  return { index, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, ...values }
}

describe('rotatePoint', () => {
  it('leaves points alone at zero rotation', () => {
    expect(rotatePoint({ x: 3, y: 4 }, { x: 1, y: 1 }, 0)).toEqual({ x: 3, y: 4 })
  })

  it('rotates clockwise on screen (y grows downward), like CSS rotate()', () => {
    // East of the origin turns to south after a quarter turn.
    const result = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(1)
  })

  it('rotates around the pivot, not the origin', () => {
    const result = rotatePoint({ x: 3, y: 2 }, { x: 2, y: 2 }, 180)
    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(2)
  })
})

describe('keyCenter', () => {
  it('is the geometric centre for an unrotated key', () => {
    const center = keyCenter(key(0, { x: 2, y: 1, w: 1.5, h: 1 }))
    expect(center.x).toBeCloseTo(2.75)
    expect(center.y).toBeCloseTo(1.5)
  })

  it('moves the centre around the key pivot when the key is rotated', () => {
    // Centre (1.5, 0.5) rotated 90° around (0, 0) lands at (-0.5, 1.5).
    const center = keyCenter(key(0, { x: 1, y: 0, r: 90, rx: 0, ry: 0 }))
    expect(center.x).toBeCloseTo(-0.5)
    expect(center.y).toBeCloseTo(1.5)
  })

  it('keeps a key that sits on its own pivot in place', () => {
    const center = keyCenter(key(0, { x: 4, y: 2, r: 30, rx: 4.5, ry: 2.5 }))
    expect(center.x).toBeCloseTo(4.5)
    expect(center.y).toBeCloseTo(2.5)
  })
})

describe('keyBox', () => {
  it('insets the box and keeps the pivot in the same board position', () => {
    const box = keyBox(key(0, { x: 2, y: 1, w: 1, h: 1, r: 15, rx: 2, ry: 1 }), 0.1)
    expect(box.left).toBeCloseTo(2.1)
    expect(box.top).toBeCloseTo(1.1)
    expect(box.width).toBeCloseTo(0.8)
    expect(box.height).toBeCloseTo(0.8)
    expect(box.rotate).toBe(15)
    // Pivot (2, 1) relative to the inset box's top-left (2.1, 1.1).
    expect(box.originX).toBeCloseTo(-0.1)
    expect(box.originY).toBeCloseTo(-0.1)
  })

  it('defaults the pivot to the origin when rx and ry are absent', () => {
    const box = keyBox({ ...key(0, { x: 1, y: 1 }), rx: undefined, ry: undefined })
    expect(box.originX).toBeCloseTo(-1)
    expect(box.originY).toBeCloseTo(-1)
  })
})

describe('boardBounds', () => {
  it('spans the unrotated keys when nothing is rotated', () => {
    const bounds = boardBounds([key(0, { x: 0, y: 0 }), key(1, { x: 2, y: 1, w: 1.25 })])
    expect(bounds).toMatchObject({ minX: 0, minY: 0, maxX: 3.25, maxY: 2, width: 3.25, height: 2 })
  })

  it('includes rotated corners, so tilted thumb keys are not clipped', () => {
    // Unrotated, this key spans x 0..1, y 1..2. Rotated 90° around the origin its corners
    // become (-1,0), (-1,1), (-2,1), (-2,0), so the board must reach x = -2.
    const bounds = boardBounds([key(0, { x: 0, y: 1, r: 90, rx: 0, ry: 0 })])
    expect(bounds.minX).toBeCloseTo(-2)
    expect(bounds.maxX).toBeCloseTo(-1)
    expect(bounds.minY).toBeCloseTo(0)
    expect(bounds.maxY).toBeCloseTo(1)
    expect(bounds.width).toBeCloseTo(1)
  })

  it('is empty for an empty layout', () => {
    expect(boardBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 })
  })
})

describe('comboSegments', () => {
  it('pairs consecutive points', () => {
    const first = { x: 0, y: 0 }
    const second = { x: 1, y: 0 }
    const third = { x: 2, y: 0 }
    expect(comboSegments([first, second, third])).toEqual([
      [first, second],
      [second, third],
    ])
  })

  it('has no segments for a single key', () => {
    expect(comboSegments([{ x: 0, y: 0 }])).toEqual([])
  })
})

describe('arcPath', () => {
  it('starts and ends at the two centres', () => {
    const { d } = arcPath({ x: 0, y: 0 }, { x: 2, y: 0 })
    expect(d).toMatch(/^M0\.000 0\.000 Q[-\d.]+ [-\d.]+ 2\.000 0\.000$/)
  })

  it('bows to the screen-up side of a horizontal chord', () => {
    const { peak } = arcPath({ x: 0, y: 0 }, { x: 2, y: 0 }, 0.5)
    expect(peak.x).toBeCloseTo(1)
    expect(peak.y).toBeCloseTo(-0.5)
  })

  it('places the midpoint of the curve at the peak', () => {
    // The quadratic's t = 0.5 point is (A + 2C + B) / 4; the control sits at twice the sag.
    const from = { x: 0, y: 2 }
    const to = { x: 2, y: 2 }
    const { d, peak } = arcPath(from, to, 0.4)
    const [, cx, cy] = d.match(/Q([-\d.]+) ([-\d.]+)/) ?? []
    const midX = (from.x + 2 * Number(cx) + to.x) / 4
    const midY = (from.y + 2 * Number(cy) + to.y) / 4
    expect(midX).toBeCloseTo(peak.x, 2)
    expect(midY).toBeCloseTo(peak.y, 2)
  })

  it('bows right for a vertical chord', () => {
    const { peak } = arcPath({ x: 0, y: 0 }, { x: 0, y: 2 }, 0.5)
    expect(peak.x).toBeCloseTo(0.5)
    expect(peak.y).toBeCloseTo(1)
  })

  it('returns a point path when both ends coincide', () => {
    const { d, peak } = arcPath({ x: 1, y: 1 }, { x: 1, y: 1 })
    expect(d).toBe('M1.000 1.000')
    expect(peak).toEqual({ x: 1, y: 1 })
  })
})
