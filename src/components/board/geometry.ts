import type { PhysicalKey } from '../../lib/zmk/types'

/** A point in key units. The origin is the top-left of the unrotated layout. */
export interface Point {
  x: number
  y: number
}

/** Placement of one keycap in key units, before the board bounds are subtracted. */
export interface KeyBox {
  /** Left edge of the (possibly inset) unrotated box. */
  left: number
  /** Top edge of the (possibly inset) unrotated box. */
  top: number
  width: number
  height: number
  /** Clockwise rotation in degrees, matching CSS `rotate()` (screen y grows downward). */
  rotate: number
  /** Rotation pivot relative to the box's top-left corner. */
  originX: number
  /** Rotation pivot relative to the box's top-left corner. */
  originY: number
}

/** Axis-aligned extent of the board, including rotated keys. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Rotation pivot of a key (`rx`, `ry` in key units). Missing values default to the origin. */
export function keyPivot(key: PhysicalKey): Point {
  return { x: finite(key.rx), y: finite(key.ry) }
}

/** Rotates a point around a pivot by `degrees`, clockwise on screen (y grows downward). */
export function rotatePoint(point: Point, pivot: Point, degrees: number): Point {
  if (degrees === 0) return point
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos }
}

/** The four corners of a key's rectangle after rotation, clockwise from top-left. */
export function keyCorners(key: PhysicalKey): Point[] {
  const pivot = keyPivot(key)
  const rotation = finite(key.r)
  const corners: Point[] = [
    { x: key.x, y: key.y },
    { x: key.x + key.w, y: key.y },
    { x: key.x + key.w, y: key.y + key.h },
    { x: key.x, y: key.y + key.h },
  ]
  return corners.map((corner) => rotatePoint(corner, pivot, rotation))
}

/** Centre of a key after its rotation has been applied. */
export function keyCenter(key: PhysicalKey): Point {
  const center = { x: key.x + key.w / 2, y: key.y + key.h / 2 }
  return rotatePoint(center, keyPivot(key), finite(key.r))
}

/**
 * Box and transform for rendering one keycap. `inset` shrinks the box on every side so that
 * neighbouring keycaps leave a visible gap; the centre and rotation pivot stay where they are.
 */
export function keyBox(key: PhysicalKey, inset = 0): KeyBox {
  const left = key.x + inset
  const top = key.y + inset
  const pivot = keyPivot(key)
  return {
    left,
    top,
    width: key.w - 2 * inset,
    height: key.h - 2 * inset,
    rotate: finite(key.r),
    originX: pivot.x - left,
    originY: pivot.y - top,
  }
}

/** Extent of every key including rotated corners, so tilted thumb keys are never clipped. */
export function boardBounds(keys: PhysicalKey[]): Bounds {
  if (keys.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  const points = keys.flatMap(keyCorners)
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/** Consecutive pairs of points: a combo with keys A, B, C is drawn as A-B and B-C. */
export function comboSegments(points: Point[]): [Point, Point][] {
  const segments: [Point, Point][] = []
  for (let index = 1; index < points.length; index++)
    segments.push([points[index - 1], points[index]])
  return segments
}

/** An SVG quadratic arc between two points, with the point where it crosses the middle. */
export interface ArcPath {
  /** SVG path data, `M … Q … …`. */
  d: string
  /** The curve's midpoint (t = 0.5), used to anchor a label. */
  peak: Point
}

const fmt = (value: number) => value.toFixed(3)

/**
 * Quadratic arc from `from` to `to` that bulges to the screen-up side of the chord. `sag` is how
 * far the midpoint sits from the chord, in key units; it defaults to a fraction of the length.
 */
export function arcPath(from: Point, to: Point, sag?: number): ArcPath {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  if (length === 0) return { d: `M${fmt(from.x)} ${fmt(from.y)}`, peak: from }

  // Unit normal, flipped so it points up the screen (negative y); vertical chords bow right.
  let nx = -dy / length
  let ny = dx / length
  if (ny > 0 || (ny === 0 && nx < 0)) {
    nx = -nx
    ny = -ny
  }
  const bow = sag ?? Math.min(2.2, Math.max(0.35, length * 0.22))
  // For a quadratic curve the midpoint sits halfway between the chord midpoint and the control.
  const control = { x: mid.x + nx * bow * 2, y: mid.y + ny * bow * 2 }
  const peak = { x: mid.x + nx * bow, y: mid.y + ny * bow }
  const path = `M${fmt(from.x)} ${fmt(from.y)} Q${fmt(control.x)} ${fmt(control.y)} ${fmt(to.x)} ${fmt(to.y)}`
  return { d: path, peak }
}
