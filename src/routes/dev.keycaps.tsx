import { createFileRoute } from '@tanstack/react-router'
import keymap from '../../fixtures/adv360/adv360.keymap?raw'
import macros from '../../fixtures/adv360/macros.dtsi?raw'
import { Keycap } from '../components/keycap/Keycap'
import { describeBinding, type Legend } from '../lib/legend/describe'
import { resolve } from '../lib/zmk'

export const Route = createFileRoute('/dev/keycaps')({ component: DevKeycaps })

const model = resolve({ 'adv360.keymap': keymap, 'macros.dtsi': macros }, 'adv360.keymap')
const layerNames = model.layers.map((layer) => layer.name)
const layerZero: Legend[] = (model.layers[0]?.bindings ?? []).map((binding) =>
  describeBinding(binding, { layerNames }),
)

const WIDTHS = [1, 1.25, 1.5, 2]
const STRESS: { label: string; behavior: string; params: string[] }[] = [
  { label: 'Keypad 1', behavior: '&kp', params: ['KP_N1'] },
  { label: '^Space', behavior: '&kp', params: ['LC(SPACE)'] },
  { label: 'Backspace', behavior: '&kp', params: ['BSPC'] },
  { label: 'Screensaver', behavior: '&kp', params: ['K_SCREENSAVER'] },
  { label: 'Hold F1 / tap 1', behavior: '&tpf', params: ['F1', 'NUMBER_1'] },
  { label: '⌘⌃4', behavior: '&kp', params: ['LG(LC(NUMBER_4))'] },
  { label: 'BT clear all', behavior: '&bt', params: ['BT_CLR_ALL'] },
  { label: 'Layer (tog 1)', behavior: '&tog', params: ['1'] },
]

function DevKeycaps() {
  return (
    <main className="min-h-screen bg-[#15151a] p-6 text-[#e8e8ee]">
      <h1 className="mb-1 text-xl font-semibold">Keycap legend dev page</h1>
      <p className="mb-6 text-sm opacity-70">
        Layer 0 of adv360.keymap ({layerZero.length} bindings), then a stress row per width.
      </p>

      <section aria-labelledby="layer-zero" className="mb-10">
        <h2 id="layer-zero" className="mb-3 text-sm font-medium opacity-80">
          Layer 0
        </h2>
        <div className="grid grid-cols-[repeat(10,minmax(0,4.5rem))] gap-2">
          {layerZero.map((legend, index) => (
            <Keycap key={index} legend={legend} />
          ))}
        </div>
      </section>

      <section aria-labelledby="stress" className="space-y-4">
        <h2 id="stress" className="mb-3 text-sm font-medium opacity-80">
          Stress legends
        </h2>
        {WIDTHS.map((width) => (
          <div key={width} className="flex flex-wrap items-end gap-2">
            <span className="w-16 text-xs opacity-60">{width}u</span>
            {STRESS.map((item) => (
              <Keycap
                key={`${width}-${item.label}`}
                w={width}
                legend={describeBinding({ behavior: item.behavior, params: item.params }, {
                  layerNames,
                })}
              />
            ))}
          </div>
        ))}
      </section>
    </main>
  )
}
