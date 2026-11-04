import { readFileSync, writeFileSync } from 'node:fs'

const source = JSON.parse(
  readFileSync('design/theme-tools/palettes/catalog.json', 'utf8'),
) as Array<Record<string, unknown>>
const audit = JSON.parse(readFileSync('docs/research/themes/license-audit.json', 'utf8')) as {
  themes: Record<string, { license: string; source: string }>
}
const cleared = source.filter(
  (item) =>
    item.type === 'semantic' ||
    ['MIT', 'Apache-2.0'].includes(audit.themes[String(item.name)]?.license ?? ''),
)
writeFileSync('src/lib/theme/presets.generated.json', JSON.stringify(cleared) + '\n')
// Copyright lines transcribed from the upstream license or README named in the audit.
const notices: Record<string, string> = {
  'folke/tokyonight.nvim': 'Author: Folke Lemaitre',
  'catppuccin/palette': 'Copyright (c) 2021 Catppuccin',
  'nordtheme/iterm2': 'Copyright © 2016 Arctic Ice Studio',
  'morhetz/gruvbox': 'Author: Pavel Pertsev <morhetz@gmail.com>',
  'rose-pine/build': 'Copyright (c) mvllow',
  'rebelot/kanagawa.nvim': 'Copyright (c) 2021 Tommaso Laurenzi',
  'icewind/everforest.iterm2': 'Copyright (c) 2021 Nikolai Osaulenko',
  'atom/atom': 'Copyright (c) 2011-2022 GitHub Inc.',
  'primer/github-vscode-theme': 'Copyright (c) 2020 Primer',
  'davidleininger/cobaltnext-vscode': 'Copyright (c) 2017 David Leininger',
  'ayu-theme/vscode-ayu': 'Copyright (c) 2016 Ike Kurghinyan',
  'kepano/flexoki': 'Copyright (c) 2023 Steph Ango',
  'nightfox.nvim': 'Copyright (c) 2021 James Simpson',
  'Everblush/everblush': 'Copyright (c) 2022 Everblush',
  'jolaleye/horizon-theme-vscode': 'Copyright (c) 2018 Jonathan Olaleye',
  'sindresorhus/iterm2-snazzy':
    'Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)',
  'kaicataldo/material.vim': 'Copyright (c) 2017 Kai Cataldo',
}
const lines = cleared.map((item) => {
  const entry = audit.themes[String(item.name)]
  const notice = entry && Object.entries(notices).find(([key]) => entry.source.includes(key))?.[1]
  return item.type === 'semantic'
    ? `- **${item.name}** — original prototype, project authors; source: design/approved/board-first-themes.html.`
    : `- **${item.name}** — ${entry.license}; ${notice ? `${notice.replace(/</g, '&lt;').replace(/>/g, '&gt;')}; ` : ''}source: ${entry.source}.`
})
writeFileSync(
  'THEMES-NOTICE.md',
  '# Theme notices\n\nTerminal palettes originate from Ghostty / iTerm2-Color-Schemes. Copyright and author lines available from upstream are reproduced below; consult each linked project for its full license.\n\n' +
    lines.join('\n') +
    '\n',
)
