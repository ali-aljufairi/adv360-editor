/** SHA-256 of UTF-8 text, computed synchronously so draft lookup is deterministic. */
export function sha256(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const length = Math.ceil((bytes.length + 9) / 64) * 64
  const buffer = new Uint8Array(length)
  buffer.set(bytes)
  buffer[bytes.length] = 128
  const view = new DataView(buffer.buffer)
  const bits = bytes.length * 8
  view.setUint32(length - 8, Math.floor(bits / 0x100000000))
  view.setUint32(length - 4, bits >>> 0)
  const primes: number[] = []
  for (let num = 2; primes.length < 64; num++) {
    if (primes.every((prime) => num % prime !== 0)) primes.push(num)
  }
  const words = primes.map((prime) => ((Math.cbrt(prime) % 1) * 0x100000000) >>> 0)
  const state = primes.slice(0, 8).map((prime) => ((Math.sqrt(prime) % 1) * 0x100000000) >>> 0)
  const rotate = (value: number, shift: number) => (value >>> shift) | (value << (32 - shift))
  for (let offset = 0; offset < length; offset += 64) {
    const block = Array.from({ length: 64 }, (_, index) =>
      index < 16 ? view.getUint32(offset + index * 4) : 0,
    )
    for (let index = 16; index < 64; index++) {
      const first = block[index - 15],
        second = block[index - 2]
      const small0 = rotate(first, 7) ^ rotate(first, 18) ^ (first >>> 3)
      const small1 = rotate(second, 17) ^ rotate(second, 19) ^ (second >>> 10)
      block[index] = (block[index - 16] + small0 + block[index - 7] + small1) >>> 0
    }
    let [aa, bb, cc, dd, ee, ff, gg, hh] = state
    for (let index = 0; index < 64; index++) {
      const big1 = rotate(ee, 6) ^ rotate(ee, 11) ^ rotate(ee, 25)
      const temp1 = (hh + big1 + ((ee & ff) ^ (~ee & gg)) + words[index] + block[index]) >>> 0
      const big0 = rotate(aa, 2) ^ rotate(aa, 13) ^ rotate(aa, 22)
      const temp2 = (big0 + ((aa & bb) ^ (aa & cc) ^ (bb & cc))) >>> 0
      hh = gg
      gg = ff
      ff = ee
      ee = (dd + temp1) >>> 0
      dd = cc
      cc = bb
      bb = aa
      aa = (temp1 + temp2) >>> 0
    }
    ;[aa, bb, cc, dd, ee, ff, gg, hh].forEach((value, index) => {
      state[index] = (state[index] + value) >>> 0
    })
  }
  return state.map((value) => value.toString(16).padStart(8, '0')).join('')
}
