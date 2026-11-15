import type { Bounds, Point, Rect } from './geometry'

/** How much of a combo label is shown. Shorter levels trade detail for room. */
export type LabelDetail = 'full' | 'label' | 'glyph'

/** One size a label can be drawn at, in key units. */
export interface LabelVariant {
  detail: LabelDetail
  width: number
  height: number
}

/** A combo label to place. Variants run from most to least detailed. */
export interface LabelRequest {
  id: string
  /** The point the label is centred on before any move, usually the arc's peak. */
  anchor: Point
  variants: LabelVariant[]
}

/** Where a label goes and which variant it uses. */
export interface LabelPlacement {
  id: string
  center: Point
  /** Index into the request's variants. */
  variant: number
  /** The detail level drawn, so the renderer need not look the variant up again. */
  detail: LabelDetail
  /** True when no spot beside the keys was free and the label sits past the board's edge. */
  fallback: boolean
}

/** Gap between a label and the thing it must not touch, in key units. */
const GAP = 0.08
/** How far from the anchor each beside-the-anchor candidate moves, in key units. */
const STEPS = [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.6, 3.2]
/** How many label widths or heights out from the board edge the fallback band searches. */
const FALLBACK_SLOTS = 24
const EPSILON = 1e-6
/** Average glyph advance in em for the label font (weight 600). Errs wide, so boxes do not clip. */
const CHAR_EM = 0.62
const GLYPH = '⋈'

/**
 * Whether two rectangles share area. Touching edges do not count.
 * @param a First rectangle.
 * @param b Second rectangle.
 * @returns True when the rectangles overlap.
 */
export function rectsOverlap(first: Rect, second: Rect): boolean {
  return (
    first.left < second.left + second.width - EPSILON &&
    second.left < first.left + first.width - EPSILON &&
    first.top < second.top + second.height - EPSILON &&
    second.top < first.top + first.height - EPSILON
  )
}

/** The rectangle of a label of the given size centred on `center`. */
function rectAt(center: Point, width: number, height: number): Rect {
  return { left: center.x - width / 2, top: center.y - height / 2, width, height }
}

/**
 * Candidate centres beside an anchor: the anchor itself, then above, below, right and left at
 * increasing distances, so the nearest free spot wins.
 */
function besideCandidates(anchor: Point, variant: LabelVariant): Point[] {
  const { width: labelWidth, height: labelHeight } = variant
  const points: Point[] = [anchor]
  for (const step of STEPS) {
    points.push(
      { x: anchor.x, y: anchor.y - (labelHeight / 2 + GAP + step) },
      { x: anchor.x, y: anchor.y + (labelHeight / 2 + GAP + step) },
      { x: anchor.x + (labelWidth / 2 + GAP + step), y: anchor.y },
      { x: anchor.x - (labelWidth / 2 + GAP + step), y: anchor.y },
    )
  }
  return points
}

/**
 * Candidate centres outside the board's bounding box, each slot one label wide along the edge.
 * Below comes first, then the sides, then above: the scroll area clips the space above the board,
 * so a label there would be hidden.
 */
function fallbackCandidates(anchor: Point, variant: LabelVariant, bounds: Bounds): Point[] {
  const { width: labelWidth, height: labelHeight } = variant
  const points: Point[] = []
  for (let slot = -FALLBACK_SLOTS; slot <= FALLBACK_SLOTS; slot++) {
    const column = anchor.x + slot * (labelWidth + GAP)
    points.push({ x: column, y: bounds.maxY + (labelHeight / 2 + GAP) })
  }
  for (let slot = -FALLBACK_SLOTS; slot <= FALLBACK_SLOTS; slot++) {
    const row = anchor.y + slot * (labelHeight + GAP)
    points.push(
      { x: bounds.maxX + (labelWidth / 2 + GAP), y: row },
      { x: bounds.minX - (labelWidth / 2 + GAP), y: row },
    )
  }
  for (let slot = -FALLBACK_SLOTS; slot <= FALLBACK_SLOTS; slot++) {
    const column = anchor.x + slot * (labelWidth + GAP)
    points.push({ x: column, y: bounds.minY - (labelHeight / 2 + GAP) })
  }
  return points
}

/** True when a rectangle lies within the board's bounding box. */
function insideBounds(rect: Rect, bounds: Bounds): boolean {
  return (
    rect.left >= bounds.minX - EPSILON &&
    rect.top >= bounds.minY - EPSILON &&
    rect.left + rect.width <= bounds.maxX + EPSILON &&
    rect.top + rect.height <= bounds.maxY + EPSILON
  )
}

/**
 * Chooses where each combo label goes. Spots inside the board's bounding box are tried first, for
 * each variant from most to least detailed, nearest to the anchor first. A spot is free when it
 * overlaps no keycap and no label placed before it. Only when no variant fits inside does the
 * shortest variant go outside the box, below the board where it stays visible.
 * @param requests Labels to place, in priority order.
 * @param keys Keycap rectangles the labels must not cover.
 * @param bounds The board's bounding box, which fallback labels sit outside of.
 * @returns One placement per request, in the same order.
 */
export function placeLabels(
  requests: LabelRequest[],
  keys: Rect[],
  bounds: Bounds,
): LabelPlacement[] {
  const occupied: Rect[] = [...keys]
  return requests.map((request) => {
    const placed = placeOne(request, occupied, bounds)
    occupied.push(placed.rect)
    return placed.placement
  })
}

function placeOne(
  request: LabelRequest,
  occupied: Rect[],
  bounds: Bounds,
): { placement: LabelPlacement; rect: Rect } {
  const fits = (center: Point, variant: LabelVariant, inside: boolean) => {
    const rect = rectAt(center, variant.width, variant.height)
    if (inside && !insideBounds(rect, bounds)) return null
    return occupied.some((other) => rectsOverlap(rect, other)) ? null : rect
  }
  for (const [index, variant] of request.variants.entries()) {
    for (const center of besideCandidates(request.anchor, variant)) {
      const rect = fits(center, variant, true)
      if (rect) {
        return {
          placement: {
            id: request.id,
            center,
            variant: index,
            detail: variant.detail,
            fallback: false,
          },
          rect,
        }
      }
    }
  }
  const index = request.variants.length - 1
  const variant = request.variants[index]
  for (const center of fallbackCandidates(request.anchor, variant, bounds)) {
    const rect = fits(center, variant, false)
    if (rect) {
      return {
        placement: {
          id: request.id,
          center,
          variant: index,
          detail: variant.detail,
          fallback: true,
        },
        rect,
      }
    }
  }
  // Unreachable in practice: the fallback band is far larger than any set of labels.
  const center = request.anchor
  return {
    placement: { id: request.id, center, variant: index, detail: variant.detail, fallback: true },
    rect: rectAt(center, variant.width, variant.height),
  }
}

/**
 * Label sizes for one combo, in key units, from the keycap unit in pixels. The sizes follow the
 * label's CSS: font size with a 9px floor, padding and a 1px border.
 * @param parts The label text and the optional note shown after it.
 * @param unit Pixels per key unit.
 * @returns The full, short and glyph-only variants, most detailed first.
 */
export function labelVariants(
  parts: { label: string; note?: string },
  unit: number,
): LabelVariant[] {
  const fontPx = Math.max(9, unit * 0.2)
  const padX = unit * 0.2
  const padY = unit * 0.07
  const sized = (detail: LabelDetail, text: string) => ({
    detail,
    width: (text.length * CHAR_EM * fontPx + 2 * padX + 2) / unit,
    height: (fontPx + 2 * padY + 2) / unit,
  })
  const full = parts.note ? `${parts.label} · ${parts.note}` : parts.label
  return [sized('full', full), sized('label', parts.label), sized('glyph', GLYPH)]
}

/** Text a label shows at a detail level. The full level includes the note. */
export function labelText(detail: LabelDetail, parts: { label: string; note?: string }): string {
  if (detail === 'full') return parts.note ? `${parts.label} · ${parts.note}` : parts.label
  if (detail === 'label') return parts.label
  return GLYPH
}
