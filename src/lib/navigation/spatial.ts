import type { PhysicalKey } from '../zmk/types'

/** A direction of travel across the board. */
export type Direction = 'left' | 'right' | 'up' | 'down'

/** Options shared by the movement helpers. */
export interface MoveOptions {
  /** When true, moving past an edge wraps to the far key of the same row or column. */
  wrap?: boolean
}

/** Half-width of a row or column band, in key units. */
const BAND = 0.5
/** Half-angle of the search cone around the direction of travel, in degrees. */
const CONE_DEGREES = 60
/** How strongly off-axis angle inflates a candidate's score; 2 means 3× at the cone edge. */
const ANGLE_WEIGHT = 2
/** Projections at or below this are treated as "behind" the origin. */
const EPSILON = 1e-6

const UNIT_VECTORS: Record<Direction, { vx: number; vy: number }> = {
  left: { vx: -1, vy: 0 },
  right: { vx: 1, vy: 0 },
  up: { vx: 0, vy: -1 },
  down: { vx: 0, vy: 1 },
}

/**
 * Centre of a key after its rotation, in key units.
 * Rotation is clockwise on screen (y grows downwards), matching KLE and CSS.
 */
export function keyCenter(key: PhysicalKey): { cx: number; cy: number } {
  const midX = key.x + key.w / 2
  const midY = key.y + key.h / 2
  if (!key.r) return { cx: midX, cy: midY }
  const originX = key.rx === undefined ? key.x : Number(key.rx)
  const originY = key.ry === undefined ? key.y : Number(key.ry)
  const angle = (key.r * Math.PI) / 180
  const offsetX = midX - originX
  const offsetY = midY - originY
  return {
    cx: originX + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    cy: originY + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  }
}

/** Binding order: array positions sorted by each key's `index` (ties keep array order). */
function bindingOrder(keys: PhysicalKey[]): number[] {
  return keys
    .map((key, position) => ({
      position,
      index: Number.isFinite(key.index) ? key.index : position,
    }))
    .sort((left, right) => left.index - right.index || left.position - right.position)
    .map((entry) => entry.position)
}

/** Returns true when `from` addresses a key in `keys`. */
function isValidOrigin(keys: PhysicalKey[], from: number): boolean {
  return Number.isInteger(from) && from >= 0 && from < keys.length
}

/**
 * Every key inside the ±60° cone in `dir` from `from`, best first.
 * Score is distance × (1 + angle / 60). For left/right moves, keys in the same row band
 * win outright when any exist, so a row is only left for a different row when it is empty.
 */
export function rankCandidates(keys: PhysicalKey[], from: number, dir: Direction): number[] {
  if (!isValidOrigin(keys, from)) return []
  const origin = keyCenter(keys[from]!)
  const { vx, vy } = UNIT_VECTORS[dir]
  const horizontal = dir === 'left' || dir === 'right'
  const found: { position: number; score: number; inBand: boolean }[] = []

  keys.forEach((key, position) => {
    if (position === from) return
    const center = keyCenter(key)
    const dx = center.cx - origin.cx
    const dy = center.cy - origin.cy
    const along = dx * vx + dy * vy
    if (along <= EPSILON) return
    const across = Math.abs(dx * vy - dy * vx)
    const angle = (Math.atan2(across, along) * 180) / Math.PI
    if (angle > CONE_DEGREES) return
    const distance = Math.hypot(dx, dy)
    found.push({
      position,
      score: distance * (1 + (ANGLE_WEIGHT * angle) / CONE_DEGREES),
      inBand: across <= BAND,
    })
  })

  const sameBand = horizontal ? found.filter((entry) => entry.inBand) : []
  const pool = sameBand.length > 0 ? sameBand : found
  return pool
    .sort((left, right) => left.score - right.score || left.position - right.position)
    .map((entry) => entry.position)
}

/**
 * Index of the key reached by one step in `dir`. Returns `from` when the move is blocked by
 * the board edge (and wrapping is off). An out-of-range origin starts at key 0.
 * Returns -1 when `keys` is empty.
 */
export function nextKey(
  keys: PhysicalKey[],
  from: number,
  dir: Direction,
  opts?: MoveOptions,
): number {
  if (keys.length === 0) return -1
  if (!isValidOrigin(keys, from)) return 0
  const [best] = rankCandidates(keys, from, dir)
  if (best !== undefined) return best
  return opts?.wrap ? wrapTarget(keys, from, dir) : from
}

/** The farthest key behind `from` in `dir`, preferring its own row or column. */
function wrapTarget(keys: PhysicalKey[], from: number, dir: Direction): number {
  const origin = keyCenter(keys[from]!)
  const { vx, vy } = UNIT_VECTORS[dir]
  const horizontal = dir === 'left' || dir === 'right'
  let bestInBand: { position: number; along: number } | undefined
  let bestAny: { position: number; along: number } | undefined

  keys.forEach((key, position) => {
    if (position === from) return
    const center = keyCenter(key)
    const dx = center.cx - origin.cx
    const dy = center.cy - origin.cy
    const along = dx * vx + dy * vy
    const across = Math.abs(dx * vy - dy * vx)
    const candidate = { position, along }
    if (!bestAny || along < bestAny.along) bestAny = candidate
    const inBand = horizontal ? Math.abs(dy) <= BAND : Math.abs(dx) <= BAND
    if (inBand && across <= BAND && (!bestInBand || along < bestInBand.along)) {
      bestInBand = candidate
    }
  })

  return (bestInBand ?? bestAny)?.position ?? from
}

/** Next key in binding order, or `from` at the end (unless wrapping). */
export function orderNext(keys: PhysicalKey[], from: number, opts?: MoveOptions): number {
  return stepOrder(keys, from, 1, opts)
}

/** Previous key in binding order, or `from` at the start (unless wrapping). */
export function orderPrev(keys: PhysicalKey[], from: number, opts?: MoveOptions): number {
  return stepOrder(keys, from, -1, opts)
}

function stepOrder(keys: PhysicalKey[], from: number, step: 1 | -1, opts?: MoveOptions): number {
  if (keys.length === 0) return -1
  const order = bindingOrder(keys)
  const at = order.indexOf(from)
  if (at === -1) return order[0]!
  const target = at + step
  if (target >= 0 && target < order.length) return order[target]!
  if (!opts?.wrap) return from
  return order[(target + order.length) % order.length]!
}

/** First key in binding order. */
export function first(keys: PhysicalKey[]): number {
  return keys.length === 0 ? -1 : bindingOrder(keys)[0]!
}

/** Last key in binding order. */
export function last(keys: PhysicalKey[]): number {
  return keys.length === 0 ? -1 : bindingOrder(keys).at(-1)!
}

/** Keys whose rotated centre lies in the same row band as `from`, including `from`. */
function rowMembers(keys: PhysicalKey[], from: number): number[] {
  const origin = keyCenter(keys[from]!)
  return keys
    .map((key, position) => ({ position, center: keyCenter(key) }))
    .filter((entry) => Math.abs(entry.center.cy - origin.cy) <= BAND)
    .map((entry) => entry.position)
}

/** Left-most key in the row of `from`. Returns `from` for an invalid origin. */
export function rowStart(keys: PhysicalKey[], from: number): number {
  if (!isValidOrigin(keys, from)) return isValidOrigin(keys, 0) ? 0 : -1
  return rowMembers(keys, from).reduce((best, position) =>
    keyCenter(keys[position]!).cx < keyCenter(keys[best]!).cx ? position : best,
  )
}

/** Right-most key in the row of `from`. Returns `from` for an invalid origin. */
export function rowEnd(keys: PhysicalKey[], from: number): number {
  if (!isValidOrigin(keys, from)) return isValidOrigin(keys, 0) ? 0 : -1
  return rowMembers(keys, from).reduce((best, position) =>
    keyCenter(keys[position]!).cx > keyCenter(keys[best]!).cx ? position : best,
  )
}
