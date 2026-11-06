import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { resolve } from '../../src/lib/zmk'

it('preserves sensor-bindings as read-only raw layer metadata', () => {
  const source = readFileSync('fixtures/zmk/sensor-bindings.keymap', 'utf8')
  const model = resolve({ 'sensor-bindings.keymap': source }, 'sensor-bindings.keymap')
  expect(model.layers[0].sensorBindings).toBe('<&inc_dec_kp C_VOL_UP C_VOL_DN &inc_dec_kp C_VOL_UP C_VOL_DN>')
})
