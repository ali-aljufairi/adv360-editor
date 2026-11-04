import { readFileSync, readdirSync } from 'node:fs'

export const files = Object.fromEntries(
  readdirSync('fixtures/adv360', { recursive: true, encoding: 'utf8' })
    .filter((path) => /\.(keymap|dtsi)$/.test(path))
    .map((path) => [path, readFileSync(`fixtures/adv360/${path}`, 'utf8')]),
)
