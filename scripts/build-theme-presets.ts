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
const lines = cleared.map((item) => {
  const entry = audit.themes[String(item.name)]
  return item.type === 'semantic'
    ? `- **${item.name}** — original prototype, project authors; source: design/approved/board-first-themes.html.`
    : `- **${item.name}** — ${entry.license}; author/source: ${entry.source}.`
})
writeFileSync(
  'THEMES-NOTICE.md',
  '# Theme notices\n\nTerminal palettes originate from Ghostty / iTerm2-Color-Schemes. Individual licenses and upstream authors are identified by the source links below; consult each linked project for its full license and copyright notice.\n\n' +
    lines.join('\n') +
    '\n',
)
