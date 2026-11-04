import { createFileRoute } from '@tanstack/react-router'
import keymap from '../../fixtures/adv360/adv360.keymap?raw'
import macros from '../../fixtures/adv360/macros.dtsi?raw'
import { resolve } from '../lib/zmk'

export const Route = createFileRoute('/')({ component: Home })
const layers = resolve({ 'adv360.keymap': keymap, 'macros.dtsi': macros }, 'adv360.keymap').layers
function Home() {
  return <main><h1>Adv360 editor</h1><h2>Layers</h2><ul>{layers.map(layer => <li key={layer.name}>{layer.displayName ?? layer.name}</li>)}</ul></main>
}
