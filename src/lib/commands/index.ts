import { scoreEntry } from '../keycodes/fuzzy'
import { PLATFORM_NAMES } from '../keycodes/platform'
import { SCHEME_LABELS, SCHEME_NAMES } from '../navigation/schemes'
import type { Command, CommandContext } from './types'

export * from './types'

/** Build the palette commands for the current editor state.
 * @param ctx - Editor state and actions.
 * @returns Commands in display order.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const active = ctx.activeLayer
  const name = ctx.layers.find((layer) => layer.index === active)?.name ?? String(active)
  const mac = ctx.displayPlatform === 'mac'
  const platforms = { auto: 'Auto', mac: 'macOS', windows: 'Windows', linux: 'Linux' }
  return [
    ...ctx.layers.map((layer): Command => ({
      id: `layer.go.${layer.index}`,
      title: `Go to ${layer.name}`,
      group: 'Layers',
      shortcut: layer.index < 9 ? String(layer.index + 1) : undefined,
      checked: layer.index === active,
      keywords: ['layer', 'switch'],
      run: () => ctx.setActiveLayer(layer.index),
    })),
    {
      id: 'layer.add',
      title: 'Add layer…',
      group: 'Layers',
      keywords: ['new', 'create'],
      run: () => ctx.addLayer(),
    },
    {
      id: 'layer.rename',
      title: `Rename ${name}…`,
      group: 'Layers',
      run: () => ctx.renameLayer(active),
    },
    {
      id: 'layer.move.left',
      title: `Move ${name} left`,
      group: 'Layers',
      disabled: active <= 1,
      run: () => ctx.moveLayer(active, active - 1),
    },
    {
      id: 'layer.move.right',
      title: `Move ${name} right`,
      group: 'Layers',
      disabled: active === 0 || active >= ctx.layers.length - 1,
      run: () => ctx.moveLayer(active, active + 1),
    },
    {
      id: 'layer.delete',
      title: `Delete ${name}…`,
      group: 'Layers',
      disabled: active === 0,
      run: () => ctx.deleteLayer(active),
    },
    ...(
      [
        ['edit.copy', 'Copy bindings', 'copy', mac ? '⌘C' : 'Ctrl+C', !ctx.batch?.selectedCount],
        [
          'edit.paste',
          'Paste bindings',
          'paste',
          mac ? '⌘V' : 'Ctrl+V',
          !ctx.batch?.canPaste || !ctx.batch?.selectedCount,
        ],
        ['edit.cut', 'Cut bindings', 'cut', mac ? '⌘X' : 'Ctrl+X', !ctx.batch?.selectedCount],
        ['edit.clear', 'Clear selected keys', 'clear', undefined, !ctx.batch?.selectedCount],
        ['edit.swap', 'Swap selected keys', 'swap', undefined, ctx.batch?.selectedCount !== 2],
        [
          'edit.swap-layers',
          'Swap key across layers…',
          'swapAcrossLayers',
          undefined,
          ctx.batch?.selectedCount !== 1,
        ],
        [
          'edit.assign-many',
          'Assign binding to selected keys…',
          'assign',
          undefined,
          !ctx.batch?.selectedCount,
        ],
        ['layer.copy', 'Copy layer to another layer…', 'copyLayer', undefined, !ctx.batch],
      ] as const
    ).map(([id, title, action, shortcut, disabled]): Command => ({
      id,
      title,
      group: id.startsWith('layer.') ? 'Layers' : 'Edit',
      shortcut,
      disabled,
      run: () => ctx.batch?.[action](),
    })),
    {
      id: 'edit.undo',
      title: 'Undo',
      group: 'Edit',
      shortcut: mac ? '⌘Z' : 'Ctrl+Z',
      disabled: !ctx.canUndo,
      run: () => ctx.undo(),
    },
    {
      id: 'edit.redo',
      title: 'Redo',
      group: 'Edit',
      shortcut: mac ? '⌘⇧Z' : 'Ctrl+Y',
      disabled: !ctx.canRedo,
      run: () => ctx.redo(),
    },
    {
      id: 'edit.review',
      title: 'Review changes',
      group: 'Edit',
      disabled: !ctx.dirty,
      run: () => ctx.reviewChanges(),
    },
    {
      id: 'edit.discard',
      title: 'Discard all changes…',
      group: 'Edit',
      disabled: !ctx.dirty,
      run: () => ctx.discardChanges(),
    },
    {
      id: 'view.combos',
      title: `${ctx.combosShown ? 'Hide' : 'Show'} combos`,
      group: 'View',
      run: () => ctx.toggleCombos(),
    },
    {
      id: 'behaviors.edit',
      title: 'Edit behaviors (hold-taps, macros, combos)',
      group: 'Behaviors',
      run: () => ctx.openBehaviors(),
    },
    ...SCHEME_NAMES.map((scheme): Command => ({
      id: `settings.scheme.${scheme}`,
      title: `Navigation: ${SCHEME_LABELS[scheme]}`,
      group: 'Settings',
      checked: ctx.scheme === scheme,
      run: () => ctx.setScheme(scheme),
    })),
    {
      id: 'settings.arrows',
      title: `Arrow keys always work: ${ctx.arrowsAlwaysOn ? 'on' : 'off'}`,
      group: 'Settings',
      run: () => ctx.setArrowsAlwaysOn(!ctx.arrowsAlwaysOn),
    },
    {
      id: 'settings.wrap',
      title: `Wrap around at board edges: ${ctx.wrap ? 'on' : 'off'}`,
      group: 'Settings',
      run: () => ctx.setWrap(!ctx.wrap),
    },
    ...PLATFORM_NAMES.map((platform): Command => ({
      id: `settings.platform.${platform}`,
      title: `Shortcuts shown for: ${platforms[platform]}`,
      group: 'Settings',
      checked: ctx.platform === platform,
      run: () => ctx.setPlatform(platform),
    })),
    {
      id: 'settings.open',
      title: 'Open settings…',
      group: 'Settings',
      run: () => ctx.openSettings(),
    },
    {
      id: 'theme.change',
      title: 'Change theme…',
      group: 'Theme',
      keywords: ['colors', 'palette'],
      run: () => ctx.openThemePicker(),
    },
    ...(['system', 'light', 'dark'] as const).map((mode): Command => ({
      id: `theme.mode.${mode}`,
      title: `Theme mode: ${mode[0].toUpperCase()}${mode.slice(1)}`,
      group: 'Theme',
      checked: ctx.themeMode === mode,
      run: () => ctx.setThemeMode(mode),
    })),
    {
      id: 'help.shortcuts',
      title: 'Keyboard shortcuts',
      group: 'Help',
      shortcut: '?',
      run: () => ctx.openHelp(),
    },
  ]
}

/** Filter and rank commands by their searchable fields.
 * @param commands - Commands in display order.
 * @param query - Search text.
 * @returns Matching commands in relevance order.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return [...commands]
  return commands
    .map((command, index) => ({
      command,
      index,
      score: scoreEntry(query, {
        label: command.title,
        code: command.title.startsWith('Go to ') ? command.title.slice(6) : undefined,
        aliases: [command.group],
        keywords: command.keywords,
      }),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(Boolean(left.command.disabled)) - Number(Boolean(right.command.disabled)) ||
        left.index - right.index,
    )
    .map((entry) => entry.command)
}

export { batchShortcut } from './shortcuts'
