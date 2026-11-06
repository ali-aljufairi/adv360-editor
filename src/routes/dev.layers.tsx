import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { LayerTabs, type LayerTab } from '../components/board/LayerTabs'
import {
  AddLayerDialog,
  DeleteLayerDialog,
  RenameLayerDialog,
  type LayerReference,
} from '../components/layers/LayerDialogs'

export const Route = createFileRoute('/dev/layers')({ component: LayersPage })

const INITIAL: LayerTab[] = [
  { index: 0, name: 'Base', unreachable: false, access: [], summary: 'Default layer' },
  {
    index: 1,
    name: 'Keypad',
    unreachable: false,
    access: [{ kind: 'hold', fromLayer: 0, key: 70, text: 'Hold key 70 on Base' }],
    summary: 'Hold on Base (key 70)',
  },
  {
    index: 2,
    name: 'Mod',
    unreachable: true,
    access: [],
    summary: 'No key reaches this layer',
  },
  {
    index: 3,
    name: 'Macro',
    unreachable: false,
    access: [{ kind: 'hold', fromLayer: 0, key: 22, text: 'Hold key 22 on Base' }],
    summary: 'Hold on Base (key 22)',
  },
  {
    index: 4,
    name: 'Windows',
    unreachable: false,
    access: [
      { kind: 'toggle', fromLayer: 3, key: 16, text: 'Toggle key 16 on Macro' },
      { kind: 'combo', fromLayer: null, key: null, positions: [46, 59], text: 'Combo 46 + 59' },
    ],
    summary: 'Toggle on Macro (key 16)',
  },
]

const REFERENCES: LayerReference[] = [
  { layer: 0, key: 22, text: '&mo Macro', reason: 'Hold key opens this layer' },
  { layer: 1, key: 12, text: '&to Macro', reason: 'Switch key jumps to this layer' },
]

type Dialog =
  { kind: 'add' } | { kind: 'rename'; index: number } | { kind: 'delete'; index: number }

/**
 * Dev-only page: LayerTabs with mock layers, wired to local state so add, rename, move and
 * delete can be tried in the browser. The dialogs are the real ones; the data is not persisted.
 * @returns The dev page.
 */
function LayersPage() {
  const [layers, setLayers] = useState<LayerTab[]>(INITIAL)
  const [active, setActive] = useState(0)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const names = layers.map((layer) => layer.name)
  const pending = dialog && dialog.kind !== 'add' ? layers[dialog.index] : undefined

  /** Re-numbers layers to match their array positions. */
  function renumber(list: LayerTab[]): LayerTab[] {
    return list.map((layer, index) => ({ ...layer, index }))
  }

  return (
    <main className="min-h-dvh bg-canvas p-4 text-primary sm:p-6">
      <h1 className="mb-4 text-xl font-semibold">Layers (dev)</h1>
      <LayerTabs
        layers={layers}
        active={active}
        onChange={setActive}
        onAdd={() => setDialog({ kind: 'add' })}
        onRename={(index) => setDialog({ kind: 'rename', index })}
        onMove={(index, to) => {
          const next = [...layers]
          ;[next[index], next[to]] = [next[to], next[index]]
          setLayers(renumber(next))
          setActive(to)
        }}
        onDelete={(index) => setDialog({ kind: 'delete', index })}
      />

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDialog({ kind: 'add' })}
          className="rounded-md border border-subtle px-3 py-1.5 text-secondary hover:bg-hover"
        >
          Open add dialog
        </button>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'rename', index: active })}
          className="rounded-md border border-subtle px-3 py-1.5 text-secondary hover:bg-hover"
        >
          Open rename dialog
        </button>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'delete', index: active })}
          className="rounded-md border border-subtle px-3 py-1.5 text-secondary hover:bg-hover"
        >
          Open delete dialog
        </button>
      </div>

      {dialog?.kind === 'add' ? (
        <AddLayerDialog
          layers={layers.map((layer) => ({ index: layer.index, name: layer.name }))}
          onClose={() => setDialog(null)}
          onCreate={({ label }) => {
            const created: LayerTab = {
              index: layers.length,
              name: label,
              unreachable: true,
              access: [],
              summary: 'No key reaches this layer',
            }
            setLayers([...layers, created])
            setActive(created.index)
            setDialog(null)
          }}
        />
      ) : null}

      {dialog?.kind === 'rename' && pending ? (
        <RenameLayerDialog
          name={pending.name}
          onClose={() => setDialog(null)}
          onRename={(label) => {
            setLayers(
              layers.map((layer) =>
                layer.index === pending.index ? { ...layer, name: label } : layer,
              ),
            )
            setDialog(null)
          }}
        />
      ) : null}

      {dialog?.kind === 'delete' && pending ? (
        <DeleteLayerDialog
          name={pending.name}
          references={pending.index === 3 ? REFERENCES : []}
          layerNames={names}
          onClose={() => setDialog(null)}
          onDelete={() => {
            const next = renumber(layers.filter((layer) => layer.index !== pending.index))
            setLayers(next)
            setActive(Math.max(0, Math.min(active, next.length - 1)))
            setDialog(null)
          }}
        />
      ) : null}
    </main>
  )
}
