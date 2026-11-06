import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react'
import { filterCommands } from '../../lib/commands'
import type { Command } from '../../lib/commands'

/** Props for {@link CommandPalette}. */
export interface CommandPaletteProps {
  open: boolean
  /** Every command, in display order (from buildCommands). */
  commands: Command[]
  onClose(): void
}

/** A rendered line in the list: a group heading, or a command row. */
type Row =
  | { kind: 'heading'; key: string; group: string }
  | { kind: 'command'; key: string; command: Command; index: number }

/** Discard is destructive, so its entry asks for a second Enter before running. */
function needsConfirm(command: Command): boolean {
  return command.id === 'edit.discard' && command.title.endsWith('…')
}

/**
 * The ⌘K command palette: a top-anchored, searchable list of every command.
 * Renders nothing while closed; each open starts with an empty search.
 * @param props - Open state, commands to list, and the close callback.
 * @returns The palette, or null when closed.
 */
export function CommandPalette({
  open,
  commands,
  onClose,
}: CommandPaletteProps): ReactElement | null {
  if (!open) return null
  return <PalettePanel commands={commands} onClose={onClose} />
}

interface PalettePanelProps {
  commands: Command[]
  onClose(): void
}

/** The open palette. Lives only while open, so its search and highlight reset each time. */
function PalettePanel({ commands, onClose }: PalettePanelProps) {
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<Command | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ranRef = useRef(false)
  const baseId = useId()
  const listId = `${baseId}-list`
  const searching = query.trim() !== ''

  const visible = useMemo(
    () => (searching ? filterCommands(commands, query) : commands),
    [commands, query, searching],
  )

  const rows = useMemo<Row[]>(() => {
    if (searching) {
      return visible.map((command, index) => ({
        kind: 'command',
        key: command.id,
        command,
        index,
      }))
    }
    const built: Row[] = []
    let previous = ''
    for (const [index, command] of visible.entries()) {
      if (command.group !== previous) {
        built.push({
          kind: 'heading',
          key: `heading-${command.group}-${index}`,
          group: command.group,
        })
        previous = command.group
      }
      built.push({ kind: 'command', key: command.id, command, index })
    }
    return built
  }, [visible, searching])

  const enabledIndexes = useMemo(
    () => visible.flatMap((command, index) => (command.disabled ? [] : [index])),
    [visible],
  )
  // The highlight is tracked by id and falls back to the first runnable row, so it never
  // points at a disabled row or a row that the current search filtered out.
  let activeIndex = visible.findIndex((command) => command.id === activeId && !command.disabled)
  if (activeIndex < 0) activeIndex = enabledIndexes[0] ?? -1
  const activeCommand = activeIndex >= 0 ? visible[activeIndex] : undefined

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => {
      // Closing without running a command gives focus back; running one may open a dialog
      // that has already claimed focus, so leave that alone.
      if (!ranRef.current) previous?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (activeIndex < 0) return
    const element = document.getElementById(`${baseId}-option-${activeIndex}`)
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, baseId])

  const move = (step: number) => {
    if (enabledIndexes.length === 0) return
    const position = enabledIndexes.indexOf(activeIndex)
    let next: number
    if (position < 0)
      next = step > 0 ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1]
    else next = enabledIndexes[(position + step + enabledIndexes.length) % enabledIndexes.length]
    setActiveId(visible[next].id)
  }

  const run = (command: Command) => {
    if (command.disabled) return
    if (needsConfirm(command) && pending?.id !== command.id) {
      setPending(command)
      return
    }
    ranRef.current = true
    onClose()
    command.run()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const key = event.key.toLowerCase()
    if (event.key === 'ArrowDown' || (event.ctrlKey && key === 'n')) {
      event.preventDefault()
      if (!pending) move(1)
    } else if (event.key === 'ArrowUp' || (event.ctrlKey && key === 'p')) {
      event.preventDefault()
      if (!pending) move(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (pending) run(pending)
      else if (activeCommand) run(activeCommand)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (pending) setPending(null)
      else onClose()
    } else if (event.key === 'Tab') {
      // Focus stays in the search box; Tab must not wander to the page behind the scrim.
      event.preventDefault()
    }
  }

  return (
    <div
      style={scrimStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Command palette" style={panelStyle}>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={
            activeCommand && !pending ? `${baseId}-option-${activeIndex}` : undefined
          }
          aria-label="Search commands"
          placeholder="Type a command…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPending(null)
          }}
          onKeyDown={onKeyDown}
          style={inputStyle}
        />
        {pending ? (
          <div role="status" style={confirmStyle}>
            Discard all unsaved changes? Enter to confirm · Esc to cancel
          </div>
        ) : null}
        <div id={listId} role="listbox" aria-label="Commands" style={listStyle}>
          {visible.length === 0 ? <div style={emptyStyle}>No matching commands</div> : null}
          {rows.map((row) =>
            row.kind === 'heading' ? (
              <div key={row.key} role="presentation" style={headingStyle}>
                {row.group}
              </div>
            ) : (
              <CommandRow
                key={row.key}
                id={`${baseId}-option-${row.index}`}
                command={row.command}
                active={row.index === activeIndex && !pending}
                onHover={() => {
                  if (!row.command.disabled) setActiveId(row.command.id)
                }}
                onRun={() => run(row.command)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

interface CommandRowProps {
  id: string
  command: Command
  active: boolean
  onHover(): void
  onRun(): void
}

/** One runnable (or dimmed) command line with its check mark and shortcut. */
function CommandRow({ id, command, active, onHover, onRun }: CommandRowProps) {
  const disabled = command.disabled === true
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      aria-disabled={disabled}
      onMouseEnter={onHover}
      onClick={onRun}
      style={rowStyle(active, disabled)}
    >
      <span aria-hidden="true" style={checkStyle}>
        {command.checked ? '✓' : ''}
      </span>
      <span style={titleStyle}>{command.title}</span>
      {command.shortcut ? <kbd style={kbdStyle}>{command.shortcut}</kbd> : null}
    </div>
  )
}

const scrimStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: 'color-mix(in srgb, var(--surface-canvas) 55%, transparent)',
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: '15vh',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(560px, calc(100vw - 32px))',
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 0,
  boxShadow: 'var(--shadow-dialog)',
  color: 'var(--text-primary)',
  overflow: 'hidden',
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  border: 0,
  borderBottom: '1px solid var(--border-subtle)',
  borderRadius: 0,
  background: 'transparent',
  color: 'var(--text-primary)',
  font: 'inherit',
  fontSize: 15,
  outline: 'none',
}

const confirmStyle: CSSProperties = {
  padding: '8px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
  fontSize: 13,
}

const listStyle: CSSProperties = {
  overflowY: 'auto',
  padding: '4px 0 6px',
}

const emptyStyle: CSSProperties = {
  padding: '14px',
  color: 'var(--text-muted)',
  fontSize: 14,
}

const headingStyle: CSSProperties = {
  padding: '10px 14px 4px',
  color: 'var(--text-muted)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const checkStyle: CSSProperties = {
  width: 12,
  flexShrink: 0,
  color: 'var(--accent-primary)',
  fontSize: 13,
}

const titleStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const kbdStyle: CSSProperties = {
  flexShrink: 0,
  marginLeft: 'auto',
  padding: '0 6px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 0,
  color: 'var(--text-muted)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  lineHeight: '20px',
}

/** Row styling: the highlight is a 2px accent rule plus stronger text, never a filled block. */
function rowStyle(active: boolean, disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 14px 7px 12px',
    borderLeft: `2px solid ${active ? 'var(--accent-primary)' : 'transparent'}`,
    color: disabled
      ? 'var(--text-muted)'
      : active
        ? 'var(--text-primary)'
        : 'var(--text-secondary)',
    fontSize: 14,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'default' : 'pointer',
  }
}
