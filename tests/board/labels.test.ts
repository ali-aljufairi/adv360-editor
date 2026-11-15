import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  arcPath,
  comboSegments,
  keyCenter,
  keyExtent,
  boardBounds,
  type Rect,
} from '../../src/components/board/geometry'
import { comboTag } from '../../src/components/board/bindings'
import {
  labelText,
  labelVariants,
  placeLabels,
  rectsOverlap,
  type LabelPlacement,
  type LabelRequest,
} from '../../src/components/board/labels'
import { getLayoutSource } from '../../src/lib/layout'
import { ADV360_PROFILE } from '../../src/lib/profile/registry'
import { resolve } from '../../src/lib/zmk'
import { files } from '../zmk/fixtures'

const cell = (column: number, row: number): Rect => ({
  left: column,
  top: row,
  width: 1,
  height: 1,
})

/** Rectangle of a placed label, given its size in key units. */
function rectOf(placement: LabelPlacement, width: number, height: number): Rect {
  return {
    left: placement.center.x - width / 2,
    top: placement.center.y - height / 2,
    width,
    height,
  }
}

const SQUARE_BOUNDS = { minX: -8, minY: -8, maxX: 8, maxY: 8, width: 16, height: 16 }

describe('placeLabels', () => {
  it('keeps the anchor when nothing covers it', () => {
    const [placement] = placeLabels(
      [
        {
          id: 'a',
          anchor: { x: 0.5, y: 0.5 },
          variants: [{ detail: 'full', width: 2, height: 0.4 }],
        },
      ],
      [cell(5, 5)],
      SQUARE_BOUNDS,
    )
    expect(placement).toEqual({
      id: 'a',
      center: { x: 0.5, y: 0.5 },
      variant: 0,
      detail: 'full',
      fallback: false,
    })
  })

  it('moves a label off a keycap that covers its anchor', () => {
    const keys = [cell(0, 0)]
    const variant = { detail: 'full' as const, width: 1.5, height: 0.4 }
    const [placement] = placeLabels(
      [{ id: 'a', anchor: { x: 0.5, y: 0.5 }, variants: [variant] }],
      keys,
      SQUARE_BOUNDS,
    )
    expect(placement.center).not.toEqual({ x: 0.5, y: 0.5 })
    expect(placement.variant).toBe(0)
    expect(placement.fallback).toBe(false)
    expect(rectsOverlap(rectOf(placement, variant.width, variant.height), keys[0])).toBe(false)
  })

  it('never lets two labels share an area', () => {
    const variant = { detail: 'full' as const, width: 2, height: 0.4 }
    const requests: LabelRequest[] = ['a', 'b', 'c'].map((id) => ({
      id,
      anchor: { x: 0.5, y: 0.5 },
      variants: [variant],
    }))
    const placements = placeLabels(requests, [], SQUARE_BOUNDS)
    const rects = placements.map((placement) => rectOf(placement, variant.width, variant.height))
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(rectsOverlap(rects[i], rects[j])).toBe(false)
      }
    }
  })

  it('drops to a shorter variant when the full text fits nowhere beside the keys', () => {
    // A 1x1 hole in a grid of keys: only the glyph-sized variant fits in it.
    const keys: Rect[] = []
    for (let column = -8; column < 8; column++)
      for (let row = -8; row < 8; row++) if (column !== 0 || row !== 0) keys.push(cell(column, row))
    const variants = [
      { detail: 'full' as const, width: 4, height: 0.4 },
      { detail: 'label' as const, width: 2.5, height: 0.4 },
      { detail: 'glyph' as const, width: 0.6, height: 0.4 },
    ]
    const [placement] = placeLabels(
      [{ id: 'a', anchor: { x: 0.5, y: 0.5 }, variants }],
      keys,
      SQUARE_BOUNDS,
    )
    expect(placement.variant).toBe(2)
    expect(placement.fallback).toBe(false)
    expect(keys.some((key) => rectsOverlap(rectOf(placement, 0.6, 0.4), key))).toBe(false)
  })

  it('sits past the board edge, clear of every key, when no spot beside the keys is free', () => {
    const keys: Rect[] = []
    for (let column = -8; column < 8; column++)
      for (let row = -8; row < 8; row++) keys.push(cell(column, row))
    const variant = { detail: 'glyph' as const, width: 0.6, height: 0.4 }
    const [placement] = placeLabels(
      [{ id: 'a', anchor: { x: 0.5, y: 0.5 }, variants: [variant] }],
      keys,
      SQUARE_BOUNDS,
    )
    const rect = rectOf(placement, variant.width, variant.height)
    expect(placement.fallback).toBe(true)
    expect(keys.some((key) => rectsOverlap(rect, key))).toBe(false)
    const outside =
      rect.top + rect.height <= SQUARE_BOUNDS.minY ||
      rect.top >= SQUARE_BOUNDS.maxY ||
      rect.left + rect.width <= SQUARE_BOUNDS.minX ||
      rect.left >= SQUARE_BOUNDS.maxX
    expect(outside).toBe(true)
  })
})

describe('labelVariants', () => {
  it('shrinks from full text to the glyph, and keeps the note only in the full variant', () => {
    const [full, label, glyph] = labelVariants(
      { label: '⋈ studio_unlock', note: 'Studio builds only' },
      44,
    )
    expect(full.width).toBeGreaterThan(label.width)
    expect(label.width).toBeGreaterThan(glyph.width)
    expect(labelText('full', { label: '⋈ a', note: 'n' })).toBe('⋈ a · n')
    expect(labelText('label', { label: '⋈ a', note: 'n' })).toBe('⋈ a')
    expect(labelText('glyph', { label: '⋈ a', note: 'n' })).toBe('⋈')
  })

  it('keeps pixel sizes from the font floor up to the keycap unit', () => {
    // At 20px per unit the font stays at its 9px floor: 9 + 2 * 1.4 padding + 2 border.
    const small = labelVariants({ label: 'x' }, 20)[1]
    expect(small.height * 20).toBeCloseTo(13.8, 5)
    const large = labelVariants({ label: 'x' }, 60)[1]
    expect(large.height * 60).toBeGreaterThan(small.height * 20)
  })
})

describe('placeLabels on the ADV360 layout', () => {
  const layout = getLayoutSource(ADV360_PROFILE.layout.source).load(
    readFileSync('fixtures/adv360/boards/arm/adv360/adv360-layouts.dtsi', 'utf8'),
    { nodeLabel: ADV360_PROFILE.layout.nodeLabel },
  )
  const model = resolve(files, 'adv360.keymap')
  const layerNames = model.layers.map((layer) => layer.displayName ?? layer.name)
  const keysByIndex = new Map(layout.keys.map((key) => [key.index, key]))
  const bounds = boardBounds(layout.keys)
  const obstacles = layout.keys.map(keyExtent)

  for (const unit of [28, 44, 64]) {
    it(`places every combo label clear of every keycap and of each other at ${unit}px per unit`, () => {
      const requests: LabelRequest[] = model.combos.map((combo, position) => {
        const centers = combo.keyPositions
          .map((index) => keysByIndex.get(index))
          .filter((key): key is NonNullable<typeof key> => key !== undefined)
          .map(keyCenter)
        const arcs = comboSegments(centers).map(([from, to]) => arcPath(from, to))
        const peak = arcs.length
          ? arcs[Math.floor((arcs.length - 1) / 2)].peak
          : { x: centers[0].x, y: centers[0].y - 0.8 }
        const { label, note } = comboTag(combo, { layerNames })
        return {
          id: `${combo.name}-${position}`,
          anchor: peak,
          variants: labelVariants({ label, note }, unit),
        }
      })
      const placements = placeLabels(requests, obstacles, bounds)
      const rects = placements.map((placement) => {
        const request = requests.find((item) => item.id === placement.id)!
        const variant = request.variants[placement.variant]
        return { id: placement.id, rect: rectOf(placement, variant.width, variant.height) }
      })
      for (const { id, rect } of rects) {
        for (const key of obstacles)
          expect({ id, hit: rectsOverlap(rect, key) }).toEqual({ id, hit: false })
      }
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i].rect, rects[j].rect)).toBe(false)
        }
      }
    })
  }
})
