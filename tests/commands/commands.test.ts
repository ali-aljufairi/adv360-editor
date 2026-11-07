import { describe, expect, it, vi } from 'vitest'
import { buildCommands, COMMAND_GROUPS, filterCommands } from '../../src/lib/commands'
import type { CommandContext } from '../../src/lib/commands'

function context(): CommandContext {
  return {
    layers: ['Default', 'Keypad', 'Extra'].map((name, index) => ({ name, index })),
    activeLayer: 1,
    setActiveLayer: vi.fn(),
    addLayer: vi.fn(),
    renameLayer: vi.fn(),
    moveLayer: vi.fn(),
    deleteLayer: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    dirty: false,
    reviewChanges: vi.fn(),
    discardChanges: vi.fn(),
    combosShown: false,
    toggleCombos: vi.fn(),
    openBehaviors: vi.fn(),
    openThemePicker: vi.fn(),
    openExport: vi.fn(),
    themeMode: 'system',
    setThemeMode: vi.fn(),
    openSettings: vi.fn(),
    openHelp: vi.fn(),
    scheme: 'arrows',
    setScheme: vi.fn(),
    arrowsAlwaysOn: true,
    setArrowsAlwaysOn: vi.fn(),
    wrap: false,
    setWrap: vi.fn(),
    platform: 'auto',
    setPlatform: vi.fn(),
    displayPlatform: 'mac',
  }
}

describe('commands', () => {
  it('orders groups and gives layers unique ids, shortcuts and checked state', () => {
    const commands = buildCommands(context())
    expect([...new Set(commands.map((command) => command.group))]).toEqual(COMMAND_GROUPS)
    expect(new Set(commands.map((command) => command.id)).size).toBe(commands.length)
    expect(commands.slice(0, 3).map(({ shortcut, checked }) => [shortcut, checked])).toEqual([
      ['1', false],
      ['2', true],
      ['3', false],
    ])
  })
  it('enforces layer boundaries and edit availability', () => {
    const ctx = context()
    for (const [active, left, right, deleted] of [
      [0, true, true, true],
      [1, true, false, false],
      [2, false, true, false],
    ] as const) {
      ctx.activeLayer = active
      const commands = buildCommands(ctx)
      expect(commands.find((command) => command.id === 'layer.move.left')?.disabled).toBe(left)
      expect(commands.find((command) => command.id === 'layer.move.right')?.disabled).toBe(right)
      expect(commands.find((command) => command.id === 'layer.delete')?.disabled).toBe(deleted)
    }
    for (const platform of ['mac', 'windows'] as const) {
      ctx.displayPlatform = platform
      const commands = buildCommands(ctx)
      expect(commands.find((command) => command.id === 'edit.undo')).toMatchObject({
        disabled: true,
        shortcut: platform === 'mac' ? '⌘Z' : 'Ctrl+Z',
      })
      expect(commands.find((command) => command.id === 'edit.redo')).toMatchObject({
        disabled: true,
        shortcut: platform === 'mac' ? '⌘⇧Z' : 'Ctrl+Y',
      })
    }
    ctx.canUndo = true
    ctx.canRedo = true
    expect(buildCommands(ctx).find((command) => command.id === 'edit.undo')?.disabled).toBe(false)
    expect(buildCommands(ctx).find((command) => command.id === 'edit.redo')?.disabled).toBe(false)
  })
  it('calls actions with their arguments', () => {
    const ctx = context()
    const commands = buildCommands(ctx)
    commands.find((command) => command.id === 'settings.scheme.vim')?.run()
    commands.find((command) => command.id === 'layer.move.right')?.run()
    expect(ctx.setScheme).toHaveBeenCalledWith('vim')
    expect(ctx.moveLayer).toHaveBeenCalledWith(1, 2)
  })
  it('ranks relevant commands', () => {
    const commands = buildCommands(context())
    for (const [query, id] of [
      ['vim', 'settings.scheme.vim'],
      ['add', 'layer.add'],
      ['dark', 'theme.mode.dark'],
      ['undo', 'edit.undo'],
    ]) {
      expect(filterCommands(commands, query)[0].id).toBe(id)
    }
    expect(
      filterCommands(commands, 'key')
        .slice(0, 3)
        .map((command) => command.id),
    ).toContain('layer.go.1')
    expect(filterCommands(commands, ' ')).toEqual(commands)
  })
})

it('registers batch commands and recognizes board-only shortcuts', async () => {
  const { batchShortcut } = await import('../../src/lib/commands')
  const ctx = context()
  const run = vi.fn()
  ctx.batch = {
    selectedCount: 2,
    canPaste: true,
    copy: run,
    paste: run,
    cut: run,
    clear: run,
    swap: run,
    swapAcrossLayers: run,
    assign: run,
    copyLayer: run,
  }
  const commands = buildCommands(ctx)
  for (const id of [
    'edit.copy',
    'edit.paste',
    'edit.cut',
    'edit.clear',
    'edit.swap',
    'edit.swap-layers',
    'edit.assign-many',
    'layer.copy',
  ])
    expect(commands.find((c) => c.id === id)).toBeDefined()
  commands.find((c) => c.id === 'edit.copy')!.run()
  expect(run).toHaveBeenCalledOnce()
  const key = { key: 'c', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }
  expect(batchShortcut(key, true)).toBe('edit.copy')
  expect(batchShortcut(key, false)).toBeNull()
})
