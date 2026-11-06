import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Board } from '../components/board/Board'
import { LayerTabs } from '../components/board/LayerTabs'
import { layerAccentOf } from '../components/board/bindings'
import { getLayoutSource } from '../lib/layout'
import { ADV360_PROFILE } from '../lib/profile/registry'
import { resolve, validate, type Layer, type Model } from '../lib/zmk'
import keymap from '../../fixtures/adv360/adv360.keymap?raw'
import macros from '../../fixtures/adv360/macros.dtsi?raw'
import version from '../../fixtures/adv360/version.dtsi?raw'
import layoutSource from '../../fixtures/adv360/boards/arm/adv360/adv360-layouts.dtsi?raw'

export const Route = createFileRoute('/dev/board')({ component: BoardPage })

const MODEL: Model = resolve(
  { 'adv360.keymap': keymap, 'macros.dtsi': macros, 'version.dtsi': version },
  'adv360.keymap',
)
const LAYOUT = getLayoutSource(ADV360_PROFILE.layout.source).load(layoutSource, {
  nodeLabel: ADV360_PROFILE.layout.nodeLabel,
})
const LAYER_NAMES = MODEL.layers.map((layer) => layer.displayName ?? layer.name)
const LEGEND_CONTEXT = {
  layerNames: LAYER_NAMES,
  macros: Object.fromEntries(
    MODEL.macros.map((macro) => {
      const label = macro.label ?? macro.name
      return [label, label]
    }),
  ),
}

/** Layers whose validator issue says they cannot be reached from the default layer. */
function unreachableLayers(model: Model): Set<number> {
  const found = new Set<number>()
  for (const issue of validate(model, { physicalLayout: LAYOUT.keys })) {
    if (issue.code !== 'unreachable-layer') continue
    const index = model.layers.findIndex(
      (layer: Layer) => layer.file === issue.file && layer.start === issue.start,
    )
    if (index >= 0) found.add(index)
  }
  return found
}

const UNREACHABLE = unreachableLayers(MODEL)

/**
 * Dev-only page: the board and layer tabs on the real ADV360 fixture. Clicking selects a key,
 * double-clicking or pressing Enter logs an activation (the picker opens here in the editor).
 * @returns The dev page.
 */
function BoardPage() {
  const [layer, setLayer] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [log, setLog] = useState<string[]>([])

  const layers = useMemo(
    () =>
      MODEL.layers.map((item, index) => ({
        index,
        name: LAYER_NAMES[index] ?? item.name,
        unreachable: UNREACHABLE.has(index),
        access: [],
        summary: '',
      })),
    [],
  )
  // Sample edits for the demo only: two keys on the default layer count as changed.
  const changedKeys = useMemo(() => new Set(layer === 0 ? [2, 5] : []), [layer])
  const layerName = LAYER_NAMES[layer] ?? `Layer ${layer}`

  return (
    <main className="min-h-dvh bg-canvas p-4 text-primary sm:p-6">
      <h1 className="mb-4 text-xl font-semibold">Board (dev)</h1>
      <LayerTabs layers={layers} active={layer} onChange={setLayer} />
      <div className="mt-6">
        <Board
          layout={LAYOUT}
          bindings={MODEL.layers[layer]?.bindings ?? []}
          legendContext={LEGEND_CONTEXT}
          selectedKey={selected}
          changedKeys={changedKeys}
          combos={MODEL.combos}
          layerAccent={layerAccentOf(layer)}
          layerIndex={layer}
          onSelectKey={setSelected}
          onActivateKey={(index) =>
            setLog((previous) =>
              [`Activated key ${index} on ${layerName}`, ...previous].slice(0, 6),
            )
          }
        />
      </div>
      <p className="mt-4 text-sm text-secondary">
        Selected: {selected === null ? 'none' : `key ${selected}`}. Keys 2 and 5 are marked as
        changed on Default for this demo.
      </p>
      <ul aria-label="Activations" className="mt-2 space-y-1 text-sm text-muted">
        {log.map((entry, position) => (
          <li key={`${position}-${entry}`}>{entry}</li>
        ))}
      </ul>
    </main>
  )
}
