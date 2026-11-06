import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Dialog } from '../editor/Dialog'

/** Longest layer name the editor accepts. */
const MAX_LABEL = 40

const FIELD = 'rounded-md border border-subtle bg-canvas px-2 py-1.5 text-primary'
const PRIMARY =
  'rounded-md bg-accent-primary px-3 py-1.5 font-medium text-[var(--on-accent)] disabled:opacity-40'
const SECONDARY = 'rounded-md border border-subtle px-3 py-1.5 text-secondary hover:bg-hover'
const DANGER = 'rounded-md bg-[var(--status-error)] px-3 py-1.5 font-medium text-[var(--on-accent)]'

/** Trims a layer name and returns it when it is valid, or null. */
function validLabel(raw: string): string | null {
  const label = raw.trim()
  return label.length > 0 && label.length <= MAX_LABEL ? label : null
}

/**
 * Focuses a text field on mount and selects its contents when `selectAll` is set.
 * @param ref The input to focus.
 * @param selectAll Whether to select the existing text.
 */
function useFocusOnMount(ref: RefObject<HTMLInputElement | null>, selectAll: boolean) {
  useEffect(() => {
    ref.current?.focus()
    if (selectAll) ref.current?.select()
  }, [ref, selectAll])
}

/** Props for the add-layer dialog. */
export interface AddLayerDialogProps {
  layers: { index: number; name: string }[]
  onCreate(input: { label: string; copyFrom?: number }): void
  onClose(): void
}

/**
 * Asks for a new layer's name and whether it starts empty or as a copy of another layer.
 * @param props - The existing layers, the create handler and the close handler.
 * @returns The add-layer dialog.
 */
export function AddLayerDialog({ layers, onCreate, onClose }: AddLayerDialogProps) {
  const input = useRef<HTMLInputElement>(null)
  useFocusOnMount(input, false)
  const [name, setName] = useState('')
  const [copy, setCopy] = useState(false)
  const [copyFrom, setCopyFrom] = useState(layers[0]?.index ?? 0)
  const [attempted, setAttempted] = useState(false)
  const label = validLabel(name)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (label === null) return
    onCreate(copy ? { label, copyFrom } : { label })
  }

  return (
    <Dialog title="Add layer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Name</span>
          <input
            ref={input}
            value={name}
            maxLength={MAX_LABEL}
            required
            aria-invalid={attempted && label === null}
            aria-describedby="add-layer-help add-layer-error"
            onChange={(event) => setName(event.target.value)}
            className={`${FIELD} w-full`}
          />
          {attempted && label === null ? (
            <span id="add-layer-error" className="block text-xs text-[var(--status-error)]">
              Enter a name of up to {MAX_LABEL} characters.
            </span>
          ) : null}
        </label>

        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1.5 font-medium">Start from</legend>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="layer-start"
              checked={!copy}
              onChange={() => setCopy(false)}
              className="mt-1"
            />
            <span>Empty — every key falls through to the layer below</span>
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" name="layer-start" checked={copy} onChange={() => setCopy(true)} />
            <span>Copy of</span>
            <select
              aria-label="Layer to copy"
              value={copyFrom}
              disabled={!copy}
              onChange={(event) => setCopyFrom(Number(event.target.value))}
              className={`${FIELD} disabled:opacity-40`}
            >
              {layers.map((layer) => (
                <option key={layer.index} value={layer.index}>
                  {layer.name}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <p id="add-layer-help" className="text-xs text-muted">
          New layers are added last. Add a key that reaches it (Layer tab in the key picker) so you
          can use it.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={SECONDARY}>
            Cancel
          </button>
          <button type="submit" className={PRIMARY} disabled={label === null && attempted}>
            Add layer
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** Props for the rename-layer dialog. */
export interface RenameLayerDialogProps {
  name: string
  onRename(label: string): void
  onClose(): void
}

/**
 * Renames a layer. Enter submits; the new name is trimmed and limited to 40 characters.
 * @param props - The current name, the rename handler and the close handler.
 * @returns The rename dialog.
 */
export function RenameLayerDialog({ name, onRename, onClose }: RenameLayerDialogProps) {
  const input = useRef<HTMLInputElement>(null)
  useFocusOnMount(input, true)
  const [value, setValue] = useState(name)
  const label = validLabel(value)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (label === null) return
    onRename(label)
  }

  return (
    <Dialog title={`Rename ${name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Name</span>
          <input
            ref={input}
            value={value}
            maxLength={MAX_LABEL}
            required
            aria-invalid={label === null}
            onChange={(event) => setValue(event.target.value)}
            className={`${FIELD} w-full`}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={SECONDARY}>
            Cancel
          </button>
          <button type="submit" className={PRIMARY} disabled={label === null}>
            Rename
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** A key elsewhere in the keymap that points at the layer being deleted. */
export interface LayerReference {
  /** Index of the layer that holds the key. */
  layer: number
  key: number | null
  text: string
  reason: string
}

/** Props for the delete-layer dialog. */
export interface DeleteLayerDialogProps {
  name: string
  references: LayerReference[]
  /** Every layer name in index order, used to name the references and the shifting layers. */
  layerNames: string[]
  onDelete(): void
  onClose(): void
}

/**
 * Confirms a layer deletion. Lists the keys that will become "none" and the layers whose
 * numbers shift down by one.
 * @param props - The layer name, its references, all layer names and the delete and close handlers.
 * @returns The delete dialog.
 */
export function DeleteLayerDialog({
  name,
  references,
  layerNames,
  onDelete,
  onClose,
}: DeleteLayerDialogProps) {
  const position = layerNames.indexOf(name)
  const shifting = position >= 0 ? layerNames.slice(position + 1) : []

  return (
    <Dialog title={`Delete ${name}`} onClose={onClose}>
      <div className="space-y-5 text-sm">
        <p>
          Keys that point at {name} will become “none”. Layers after it move down one number
          {shifting.length > 0 ? `: ${shifting.join(', ')}.` : ' (there are none after it).'}
        </p>

        <section aria-labelledby="delete-refs-heading" className="space-y-2">
          <h3 id="delete-refs-heading" className="font-medium">
            {references.length === 0
              ? 'No keys point at this layer.'
              : `${references.length} ${references.length === 1 ? 'key' : 'keys'} will be cleared`}
          </h3>
          {references.length > 0 ? (
            <ul className="max-h-60 space-y-1.5 overflow-y-auto">
              {references.map((reference, at) => (
                <li
                  // References have no id; the list is fixed while the dialog is open.
                  key={at}
                  className="rounded-md border border-subtle bg-canvas px-2.5 py-1.5"
                >
                  <div className="font-mono text-xs break-words text-primary">
                    {layerNames[reference.layer] ?? `Layer ${reference.layer}`}
                    {reference.key !== null ? ` · key ${reference.key}` : ''}
                    {reference.text ? ` · ${reference.text}` : ''}
                  </div>
                  <div className="text-xs text-muted">{reference.reason}</div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={SECONDARY}>
            Cancel
          </button>
          <button type="button" onClick={onDelete} className={DANGER}>
            Delete layer
          </button>
        </div>
      </div>
    </Dialog>
  )
}
