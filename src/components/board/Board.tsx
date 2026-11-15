import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { Keycap } from '../keycap/Keycap'
import { batchShortcut } from '../../lib/commands/shortcuts'
import { describeBinding, type DescribeContext } from '../../lib/legend/describe'
import type { PhysicalLayout } from '../../lib/layout'
import type { Binding, Combo, PhysicalKey } from '../../lib/zmk/types'
import { comboTag, layerAccentOf, layerTargetOf, legendText } from './bindings'
import {
  arcPath,
  boardBounds,
  comboSegments,
  keyBox,
  keyCenter,
  keyExtent,
  type Point,
} from './geometry'
import {
  labelText,
  labelVariants,
  placeLabels,
  type LabelPlacement,
  type LabelRequest,
} from './labels'
import type { KeyIssue, Severity } from '../panels/issues'

/** Quiet marker drawn on a keycap, one colour per severity. */
const ISSUE_COLOR: Record<Severity, string> = {
  error: 'var(--status-error)',
  warning: 'var(--status-warning)',
  info: 'var(--status-info)',
}

/** Batch commands the board forwards from the keyboard. */
export type BatchCommand = 'edit.copy' | 'edit.paste' | 'edit.cut' | 'edit.clear'

/** Modifier that turns a key click into a range or toggle selection. */
export type SelectModifier = 'range' | 'toggle'

/** Props for the physical keyboard board. */
export interface BoardProps {
  layout: PhysicalLayout
  /** Bindings of the active layer, indexed by physical key index. */
  bindings: Binding[]
  /** Layer names and macro labels used to describe bindings. */
  legendContext: DescribeContext
  selectedKey: number | null
  /** Every selected key, including the anchor. Keys in it show the selection ring. */
  selectedKeys?: ReadonlySet<number>
  /** Keys whose binding differs from the saved keymap on this layer. */
  changedKeys: Set<number>
  /** Combos drawn as arcs. Combos not active on the shown layer are dimmed. */
  combos: Combo[]
  /** Accent slot of the active layer, 1–4 for `var(--layer-N)`. */
  layerAccent: 1 | 2 | 3 | 4
  /** Layer number on screen. Defaults to `layerAccent - 1`; pass it when layers exceed four. */
  layerIndex?: number
  /** Draw combo arcs and their labels. Defaults to true. */
  showCombos?: boolean
  /**
   * Problems on the shown layer, keyed by physical key index. Each key gets a thin marker in its
   * most serious colour, and its problem messages go in the key's tooltip.
   */
  issueKeys?: ReadonlyMap<number, KeyIssue>

  /** Click on a key. Shift extends a range, Cmd/Ctrl toggles it, and a plain click replaces. */
  onSelectKey(index: number, modifier?: SelectModifier): void
  /** Double-click or Enter on a key: open the binding picker. */
  onActivateKey(index: number): void
  /** Right-click, the context-menu key or Shift+F10 on a key. Coordinates are viewport pixels. */
  onKeyContextMenu?(index: number, x: number, y: number): void
  /** Copy, paste, cut or clear from the keyboard, while the board owns focus. */
  onBatchCommand?(command: BatchCommand): void
}

/** Shift wins over Cmd/Ctrl, so Shift+Cmd+click extends a range. */
function modifierOf(event?: MouseEvent<HTMLElement>): SelectModifier | undefined {
  if (!event) return undefined
  if (event.shiftKey) return 'range'
  if (event.metaKey || event.ctrlKey) return 'toggle'
  return undefined
}

/** True for controls that own their own keyboard editing. */
function isEditable(target: EventTarget): boolean {
  const element = target as HTMLElement
  return (
    element.isContentEditable ||
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT'
  )
}

/** Gap between neighbouring keycaps, in key units. */
const KEY_INSET = 0.06
/** Pixels per key unit before the first measurement, so server rendering has a size. */
const DEFAULT_UNIT = 44
/** Largest pixels per key unit, so a wide desktop does not blow the board up. */
const MAX_UNIT = 72
const ARC_STROKE = 0.075
const ARC_DASH = '0.24 0.16'
const EMPTY_SELECTION: ReadonlySet<number> = new Set()
const EMPTY_ISSUES: ReadonlyMap<number, KeyIssue> = new Map()

interface ComboDrawing {
  key: string
  paths: string[]
  anchor: Point
  label: string
  note?: string
  studio: boolean
  active: boolean
}

function drawCombos(
  combos: Combo[],
  keys: Map<number, PhysicalKey>,
  ctx: DescribeContext,
  layerIndex: number,
): ComboDrawing[] {
  const drawings: ComboDrawing[] = []
  combos.forEach((combo, position) => {
    const centers = combo.keyPositions
      .map((index) => keys.get(index))
      .filter((key): key is PhysicalKey => key !== undefined)
      .map(keyCenter)
    if (centers.length === 0) return
    const { label, note, studio } = comboTag(combo, ctx)
    const arcs = comboSegments(centers).map(([from, to]) => arcPath(from, to))
    const peak = arcs.length
      ? arcs[Math.floor((arcs.length - 1) / 2)].peak
      : { x: centers[0].x, y: centers[0].y - 0.8 }
    drawings.push({
      key: `${combo.name}-${position}`,
      paths: arcs.map((arc) => arc.d),
      anchor: peak,
      label,
      note,
      studio,
      active: !combo.layers || combo.layers.includes(layerIndex),
    })
  })
  return drawings
}

/**
 * Physical keyboard drawn from layout geometry. Keys are absolutely positioned and rotated
 * around their pivot; the whole board scales to the width of its container.
 */
export function Board({
  layout,
  bindings,
  legendContext,
  selectedKey,
  selectedKeys = EMPTY_SELECTION,
  changedKeys,
  combos,
  layerAccent,
  layerIndex: layerIndexProp,
  showCombos = true,
  issueKeys = EMPTY_ISSUES,
  onSelectKey,
  onActivateKey,
  onKeyContextMenu,
  onBatchCommand,
}: BoardProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)

  useEffect(() => {
    const element = frame.current
    if (!element) return
    setFrameWidth(element.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setFrameWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const bounds = useMemo(() => boardBounds(layout.keys), [layout.keys])
  const unit =
    frameWidth > 0 && bounds.width > 0
      ? Math.min(MAX_UNIT, frameWidth / bounds.width)
      : DEFAULT_UNIT
  const layerIndex = layerIndexProp ?? layerAccent - 1
  const layerName = legendContext.layerNames?.[layerIndex] ?? `Layer ${layerIndex}`
  const accentVar = `var(--layer-${layerAccent})`

  const keysByIndex = useMemo(
    () => new Map(layout.keys.map((key) => [key.index, key])),
    [layout.keys],
  )
  const drawings = useMemo(
    () => (showCombos ? drawCombos(combos, keysByIndex, legendContext, layerIndex) : []),
    [showCombos, combos, keysByIndex, legendContext, layerIndex],
  )
  const keyRects = useMemo(() => layout.keys.map(keyExtent), [layout.keys])
  // Label spots depend on the pixel unit, because label boxes have pixel padding and font sizes.
  const placements = useMemo(() => {
    const requests: LabelRequest[] = drawings.map((drawing) => ({
      id: drawing.key,
      anchor: drawing.anchor,
      variants: labelVariants(drawing, unit),
    }))
    const byId = new Map<string, LabelPlacement>()
    for (const placement of placeLabels(requests, keyRects, bounds)) {
      byId.set(placement.id, placement)
    }
    return byId
  }, [drawings, keyRects, bounds, unit])

  const boardStyle = {
    width: bounds.width * unit,
    height: bounds.height * unit,
    '--keycap-unit': `${unit}px`,
  } as CSSProperties

  /** Copy, paste, cut and clear, plus Delete/Backspace to clear, while the board has focus. */
  const onBoardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onBatchCommand || isEditable(event.target)) return
    const boardFocused = event.currentTarget.contains(document.activeElement)
    const plainDelete =
      (event.key === 'Delete' || event.key === 'Backspace') &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    const command = batchShortcut(event, boardFocused) ?? (plainDelete ? 'edit.clear' : null)
    if (!command) return
    event.preventDefault()
    onBatchCommand(command)
  }

  return (
    <div ref={frame} className="w-full min-w-0">
      <div
        role="group"
        aria-label={`Keyboard, ${layerName}`}
        className="relative mx-auto"
        style={boardStyle}
        onKeyDown={onBoardKeyDown}
      >
        {layout.keys.map((key) => {
          const binding = bindings[key.index]
          if (!binding) return null
          const legend = describeBinding(binding, legendContext)
          const box = keyBox(key, KEY_INSET)
          const target = layerTargetOf(binding, legendContext.layerNames)
          const glow = target === undefined ? undefined : `var(--layer-${layerAccentOf(target)})`
          const changed = changedKeys.has(key.index)
          const issue = issueKeys.get(key.index)
          const issueTitle = issue ? issue.messages.join('\n') : undefined
          const select = (event?: MouseEvent<HTMLButtonElement>) =>
            onSelectKey(key.index, modifierOf(event))
          return (
            <div
              key={key.index}
              role="group"
              aria-label={`${layerName}, key ${key.index}: ${legendText(legend)}`}
              aria-description={issue ? issue.messages.join('. ') : undefined}
              className="absolute z-[1] flex [&>button]:!size-full"
              data-key-index={key.index}
              style={{
                left: (box.left - bounds.minX) * unit,
                top: (box.top - bounds.minY) * unit,
                width: box.width * unit,
                height: box.height * unit,
                transform: `rotate(${box.rotate}deg)`,
                transformOrigin: `${box.originX * unit}px ${box.originY * unit}px`,
              }}
              onDoubleClick={() => onActivateKey(key.index)}
              onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
                if (!onKeyContextMenu) return
                event.preventDefault()
                onKeyContextMenu(key.index, event.clientX, event.clientY)
              }}
              onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  if (!onKeyContextMenu) return
                  event.preventDefault()
                  const box = event.currentTarget.getBoundingClientRect()
                  onKeyContextMenu(key.index, box.left, box.bottom)
                  return
                }
                if (event.key !== 'Enter') return
                // Stop the button's native click so Enter selects and activates exactly once.
                event.preventDefault()
                select()
                onActivateKey(key.index)
              }}
            >
              {glow ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md"
                  style={{ boxShadow: `0 0 0 2px ${glow}` }}
                />
              ) : null}
              <Keycap
                legend={legend}
                w={box.width}
                selected={selectedKey === key.index || selectedKeys.has(key.index)}
                onSelect={select}
                title={issueTitle ? `${legendText(legend)}\n${issueTitle}` : undefined}
              />
              {issue ? (
                <span
                  aria-hidden="true"
                  data-issue={issue.severity}
                  className="pointer-events-none absolute"
                  style={{
                    background: ISSUE_COLOR[issue.severity],
                    height: 2,
                    left: '22%',
                    right: '22%',
                    bottom: 0,
                  }}
                />
              ) : null}
              {changed ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    background: accentVar,
                    width: unit * 0.12,
                    height: unit * 0.12,
                    right: '8%',
                    top: '8%',
                  }}
                />
              ) : null}
            </div>
          )
        })}

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-0 overflow-visible"
          width={bounds.width * unit}
          height={bounds.height * unit}
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        >
          {drawings.flatMap((drawing) =>
            drawing.paths.map((pathData) => (
              <path
                key={`${drawing.key}-${pathData}`}
                d={pathData}
                fill="none"
                stroke="var(--arc-combo)"
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
                strokeDasharray={drawing.studio ? ARC_DASH : undefined}
                opacity={drawing.active ? 0.6 : 0.12}
              />
            )),
          )}
        </svg>

        {drawings.map((drawing) => {
          const placement = placements.get(drawing.key)
          if (!placement) return null
          const detail = placement.detail
          const full = labelText('full', drawing)
          const compact = detail !== 'full'
          return (
            <span
              key={drawing.key}
              title={compact ? full : undefined}
              className={`absolute z-[3] -translate-x-1/2 -translate-y-1/2 rounded-[2px] whitespace-nowrap ${
                compact ? '' : 'pointer-events-none'
              }`}
              data-label-detail={detail}
              style={{
                left: (placement.center.x - bounds.minX) * unit,
                top: (placement.center.y - bounds.minY) * unit,
                fontSize: Math.max(9, unit * 0.2),
                padding: `${unit * 0.07}px ${unit * 0.2}px`,
                fontWeight: 600,
                lineHeight: 1,
                color: drawing.studio ? 'var(--text-primary)' : 'var(--arc-combo)',
                border: `1px ${drawing.studio ? 'dashed' : 'solid'} color-mix(in srgb, var(--arc-combo) 45%, transparent)`,
                opacity: drawing.active ? 1 : 0.4,
              }}
            >
              {detail === 'full' ? (
                <>
                  {drawing.label}
                  {drawing.note ? (
                    <em className="ml-1 font-bold not-italic" style={{ color: 'var(--arc-combo)' }}>
                      · {drawing.note}
                    </em>
                  ) : null}
                </>
              ) : (
                labelText(detail, drawing)
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
