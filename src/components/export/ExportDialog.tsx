import { useMemo, useState, type FormEvent } from 'react'
import { Dialog } from '../editor/Dialog'
import { exportKeymap } from '../../lib/export'
import { svgToPng } from '../../lib/export/png'
import type { PhysicalLayout } from '../../lib/layout'
import type { Tokens } from '../../lib/theme/tokens'
import type { Model } from '../../lib/zmk'

type Format = 'svg' | 'png' | 'print'
type Scale = 1 | 2

const FORMATS: { id: Format; label: string }[] = [
  { id: 'svg', label: 'SVG' },
  { id: 'png', label: 'PNG' },
  { id: 'print', label: 'Print' },
]
const SCALES: Scale[] = [1, 2]

const PRIMARY =
  'rounded-[2px] bg-accent-primary px-3 py-1.5 font-medium text-[var(--on-accent)] disabled:opacity-40'
const SECONDARY = 'rounded-[2px] border border-subtle px-3 py-1.5 text-secondary hover:bg-hover'

/** Text option: underlined when active, no fill or pill. */
function option(active: boolean): string {
  return `text-sm underline-offset-4 hover:text-primary ${
    active ? 'text-primary underline' : 'text-muted'
  }`
}

/** Makes a layer title safe to use as a file name. */
function fileName(title: string): string {
  return title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'layer'
}

/** Saves a blob through a temporary object URL. */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens the print dialog for a document in a hidden iframe, then removes the iframe. */
function printDocument(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.srcdoc = html
  frame.onload = () => {
    try {
      frame.contentWindow?.print()
    } finally {
      frame.remove()
    }
  }
  document.body.append(frame)
}

/** Props for the export dialog. */
export interface ExportDialogProps {
  model: Model
  layout: PhysicalLayout
  tokens: Tokens
  layers: { index: number; name: string }[]
  onClose(): void
}

/**
 * Exports the keymap as SVG, PNG or a printable document. Every layer starts selected, and a
 * preview shows the first selected layer.
 * @param props - The keymap, layout, theme tokens, layers and close handler.
 * @returns The export dialog.
 */
export function ExportDialog({ model, layout, tokens, layers, onClose }: ExportDialogProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(layers.map((layer) => layer.index)),
  )
  const [format, setFormat] = useState<Format>('svg')
  const [scale, setScale] = useState<Scale>(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = layers.filter((layer) => selected.has(layer.index))
  const first = chosen[0]?.index
  const preview = useMemo(
    () => (first === undefined ? '' : exportKeymap(model, layout, [first], tokens).layers[0].svg),
    [model, layout, tokens, first],
  )

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (chosen.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = exportKeymap(
        model,
        layout,
        chosen.map((layer) => layer.index),
        tokens,
      )
      if (format === 'print') {
        printDocument(result.printableDocument)
      } else {
        for (const item of result.layers) {
          const name = fileName(item.title)
          if (format === 'svg') {
            download(new Blob([item.svg], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`)
          } else {
            download(await svgToPng(item.svg, scale), `${name}.png`)
          }
        }
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const action = format === 'print' ? 'Print' : 'Export'

  return (
    <Dialog title="Export keymap" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1.5 font-medium">Layers</legend>
          {layers.map((layer) => (
            <label key={layer.index} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(layer.index)}
                onChange={() => toggle(layer.index)}
              />
              <span>{layer.name}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
            <legend className="mb-1.5 text-sm font-medium">Format</legend>
            {FORMATS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={format === item.id}
                onClick={() => setFormat(item.id)}
                className={option(format === item.id)}
              >
                {item.label}
              </button>
            ))}
          </fieldset>

          {format === 'png' ? (
            <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
              <legend className="mb-1.5 text-sm font-medium">Scale</legend>
              {SCALES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={scale === value}
                  onClick={() => setScale(value)}
                  className={option(scale === value)}
                >
                  {value}×
                </button>
              ))}
            </fieldset>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Preview</span>
          {preview ? (
            <div
              className="border border-subtle p-2 [&>svg]:block [&>svg]:h-auto [&>svg]:max-h-[40vh] [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          ) : (
            <p className="text-sm text-muted">Select a layer to preview.</p>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[var(--status-error)]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={SECONDARY}>
            Cancel
          </button>
          <button type="submit" className={PRIMARY} disabled={chosen.length === 0 || busy}>
            {busy ? 'Exporting…' : action}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
