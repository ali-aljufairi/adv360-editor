import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'vendor/zmk/adv360-z3.5-2'
const read = (name: string) =>
  readFileSync(`${dir}/${name}`, 'utf8')
    .replace(/\\\r?\n/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
const definitions = new Map<string, string>()
for (const file of ['hid_usage.h', 'hid_usage_pages.h', 'keys.h']) {
  for (const match of read(file).matchAll(/^#define\s+(\w+)\s+\(([^\n]+)\)/gm))
    definitions.set(match[1], `(${match[2]})`)
}
function resolve(name: string, seen = new Set<string>()): number {
  if (seen.has(name)) throw new Error(`Circular definition: ${name}`)
  const expression = definitions.get(name)
  if (!expression) throw new Error(`Missing definition: ${name}`)
  const next = new Set(seen).add(name)
  const expanded = expression
    .replace(/ZMK_HID_USAGE\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g, '($1 << 16 | $2)')
    .replace(/LS\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, '(0x02000000 | $1)')
    .replace(/\b(?!0x[\da-f]+\b)[A-Za-z_]\w*\b/gi, (id) => String(resolve(id, next)))
  if (!/^[\d\s()+|<>xabcdef-]+$/i.test(expanded)) throw new Error(`Invalid expression: ${expanded}`)
  return Function(`"use strict"; return (${expanded})`)() >>> 0
}
const names = [...read('keys.h').matchAll(/^#define\s+(\w+)\s+\(/gm)].map((m) => m[1])
const values: Record<string, number> = {}
const groups: Record<string, string[]> = {}
for (const name of names) {
  const value = resolve(name)
  values[name] = value
  ;(groups[value] ||= []).push(name)
}

const keySource = read('keys.h')
const headerLabels = new Map<string, string>()
for (const match of keySource.matchAll(
  /\/\*\s*([^*]*(?:\*(?!\/)[^*]*)*)\s*\*\/\s*\r?\n#define\s+(\w+)\b/g,
)) {
  const label = match[1].replace(/\s+/g, ' ').trim()
  if (label && !/deprecated|warning/i.test(label)) headerLabels.set(match[2], label)
}
const humanize = (name: string): string => {
  const withoutPrefix = name.replace(/^(?:C_AC_|C_AL_|C_|K_|KP_|INT_|LANG_|M_)/, '')
  return withoutPrefix
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}
const labels = Object.fromEntries(
  names.map((name) => [name, headerLabels.get(name) ?? humanize(name)]),
)
writeFileSync(
  'src/lib/keycodes/zmk-keys.generated.json',
  `${JSON.stringify({ values, groups, labels }, null, 2)}\n`,
)
console.log(`Generated ${names.length} key names`)
