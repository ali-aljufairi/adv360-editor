import type { CSSProperties, ReactNode } from 'react'
import type { Legend } from '../../lib/legend/describe'
import { LEGEND_SCALE, UNIT_EM, fitLegend, type LegendSize } from '../../lib/legend/fit'

/** Props for a single keycap. */
export interface KeycapProps {
  /** Legend to display, usually from `describeBinding`. */
  legend: Legend
  /** Keycap width in units (1, 1.25, 1.5, 2, ...). Defaults to 1. */
  w?: number
  /** Whether this key is the current selection. */
  selected?: boolean
  /** Whether this key differs from the saved keymap. */
  changed?: boolean
  /** Called when the key is activated. Without it the keycap is still a button but inert. */
  onSelect?: () => void
  /** Optional tooltip. Defaults to the full, un-abbreviated legend. */
  title?: string
}

/**
 * Keycap base unit, controlled by the `--keycap-unit` CSS variable. The legend font is
 * `unit / UNIT_EM` so the width model in `fitLegend` matches what the browser draws.
 */
const UNIT = 'var(--keycap-unit, 3.5rem)'

/**
 * Accent colour per legend kind, drawn as a bottom strip. Uses the tokens documented in
 * docs/theme.md; kinds without a token get no strip, so every key keeps `--keycap-face`.
 */
const KIND_ACCENT: Partial<Record<Legend['kind'], string>> = {
  layer: 'var(--layer-1)',
  holdtap: 'var(--arc-holdtap)',
  macro: 'var(--arc-macro)',
  bluetooth: 'var(--arc-bluetooth)',
}

/** CSS font-size for a legend step, derived from the keycap unit. */
function fontSize(size: LegendSize, scale = 1): string {
  return `calc(${UNIT} / ${UNIT_EM} * ${LEGEND_SCALE[size] * scale})`
}

/** Splits fitted text on its line break and renders each line on its own row. */
function lines(text: string): ReactNode {
  return text.split('\n').map((line, index) => (
    <span key={index} className="block">
      {line}
    </span>
  ))
}

/**
 * A keycap showing a fitted legend. Legends always fit the keycap width: abbreviation,
 * font-size step-down and two-line wrapping happen in `fitLegend`, not in CSS.
 */
export function Keycap({
  legend,
  w: units = 1,
  selected = false,
  changed = false,
  onSelect,
  title,
}: KeycapProps) {
  const full = [legend.primary, legend.secondary].filter(Boolean).join(', ') || 'Empty key'
  const main = fitLegend(legend.primary, units)
  const sub = legend.secondary ? fitLegend(legend.secondary, units) : null

  const accent = KIND_ACCENT[legend.kind]
  const shadows = [
    selected ? '0 0 0 2px var(--focus-ring, #7aa2ff)' : null,
    `inset 0 -3px 0 ${accent ?? 'var(--keycap-side, #15161b)'}`,
  ]
  const style: CSSProperties = {
    width: `calc(${UNIT} * ${units})`,
    height: UNIT,
    background: 'var(--keycap-face, #2b2d33)',
    color: 'var(--keycap-legend, #f2f2f5)',
    boxShadow: shadows.filter(Boolean).join(', '),
  }

  return (
    <button
      type="button"
      className="relative inline-flex flex-col items-center justify-center overflow-visible rounded-md border border-black/40 px-px text-center leading-[1.05] font-medium select-none focus-visible:shadow-[0_0_0_2px_var(--focus-ring,#7aa2ff)] focus-visible:outline-none"
      style={style}
      aria-label={full}
      aria-pressed={onSelect ? selected : undefined}
      title={title ?? full}
      data-kind={legend.kind}
      data-selected={selected || undefined}
      data-changed={changed || undefined}
      onClick={onSelect}
    >
      {sub ? (
        <span
          className="absolute top-[3%] left-[6%] leading-none opacity-80"
          style={{ fontSize: fontSize(sub.size, 0.6), color: 'var(--keycap-sublegend, #a3a6b3)' }}
        >
          {lines(sub.text)}
        </span>
      ) : null}
      <span
        className="whitespace-pre"
        style={{ fontSize: fontSize(main.size), lineHeight: main.lines === 2 ? 1 : 1.1 }}
      >
        {lines(main.text)}
      </span>
      {changed ? (
        <span
          aria-hidden="true"
          className="absolute top-[4%] right-[6%] size-1.5 rounded-full"
          style={{ background: 'var(--status-warning, #f5b841)' }}
        />
      ) : null}
    </button>
  )
}
