import { useRef, type KeyboardEvent } from 'react'
import { layerAccentOf } from './bindings'

/** One layer tab. `unreachable` layers get a warning dot and an explanation on hover. */
export interface LayerTab {
  index: number
  name: string
  unreachable: boolean
}

/** Props for the layer switcher. */
export interface LayerTabsProps {
  layers: LayerTab[]
  /** Index of the selected layer. */
  active: number
  onChange(index: number): void
}

/**
 * Pill-shaped layer tabs. Arrow keys, Home and End move between tabs and select them, following
 * the WAI-ARIA tabs pattern. Number-key shortcuts belong to the page, not to this component.
 */
export function LayerTabs({ layers, active, onChange }: LayerTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    const last = layers.length - 1
    const targets: Record<string, number> = {
      ArrowRight: position === last ? 0 : position + 1,
      ArrowLeft: position === 0 ? last : position - 1,
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(layers[next].index)
    buttons.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label="Layers" className="flex flex-wrap items-center gap-1">
      {layers.map((layer, position) => {
        const selected = layer.index === active
        const accent = `var(--layer-${layerAccentOf(layer.index)})`
        const onAccent = `var(--on-layer-${layerAccentOf(layer.index)})`
        const tipId = `layer-tab-tip-${layer.index}`
        return (
          <div key={layer.index} className="group relative">
            <button
              ref={(node) => {
                buttons.current[position] = node
              }}
              type="button"
              role="tab"
              id={`layer-tab-${layer.index}`}
              aria-selected={selected}
              aria-describedby={layer.unreachable ? tipId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(layer.index)}
              onKeyDown={(event) => handleKey(event, position)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              style={
                selected
                  ? { background: accent, color: onAccent, boxShadow: `0 6px 16px -8px ${accent}` }
                  : { color: 'var(--text-secondary)' }
              }
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{
                  background: selected ? onAccent : accent,
                  boxShadow: selected ? 'none' : `0 0 0 3px color-mix(in srgb, ${accent} 22%, transparent)`,
                }}
              />
              {layer.name}
              {layer.unreachable ? (
                <span
                  aria-hidden="true"
                  className="size-2 animate-pulse rounded-full"
                  style={{ background: 'var(--status-warning)' }}
                />
              ) : null}
            </button>
            {layer.unreachable ? (
              <span
                role="tooltip"
                id={tipId}
                className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 hidden w-max max-w-56 -translate-x-1/2 rounded-md border px-2 py-1 text-xs group-focus-within:block group-hover:block"
                style={{
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--status-warning)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-float)',
                }}
              >
                {layer.name} can’t be reached from another layer
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
