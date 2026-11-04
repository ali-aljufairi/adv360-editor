import { createFileRoute } from '@tanstack/react-router'
import keymap from '../../fixtures/adv360/adv360.keymap?raw'
import macros from '../../fixtures/adv360/macros.dtsi?raw'
import { resolve } from '../lib/zmk'
import { useTheme } from '../lib/theme/ThemeProvider'

export const Route = createFileRoute('/')({ component: Home })
const layers = resolve({ 'adv360.keymap': keymap, 'macros.dtsi': macros }, 'adv360.keymap').layers
function Home() {
  const theme=useTheme()
  return <main><h1>Adv360 editor</h1><h2>Layers</h2><ul>{layers.map((layer) => <li key={layer.name}>{layer.displayName ?? layer.name}</li>)}</ul><label>Theme <select value={theme.active.id} onChange={event=>{theme.preview(event.target.value)}}>{theme.presets.map(value737=><option key={value737.id} value={value737.id}>{value737.name}</option>)}</select></label><button onClick={theme.commit}>Apply theme</button><div aria-label="Theme colors" className="flex gap-2">{['bg-canvas','bg-surface','bg-keycap','bg-accent-layer-1','bg-accent-layer-2','bg-accent-layer-3','bg-accent-layer-4'].map(value1065=><span key={value1065} className={`${value1065} h-8 w-8 border border-subtle`} />)}</div></main>
}
