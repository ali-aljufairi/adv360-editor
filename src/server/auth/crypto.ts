const encoder = new TextEncoder()

async function key(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('adv360-session'),
      info: encoder.encode('v1'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

/** Encrypt JSON into an authenticated, versioned cookie value. */
export async function seal(value: unknown, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(secret),
    encoder.encode(JSON.stringify(value)),
  )
  return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`
}

/** Decrypt and parse a cookie, returning null for invalid values. */
export async function unseal<T>(value: string, secret: string): Promise<T | null> {
  try {
    const parts = value.split('.')
    if (
      parts.length !== 3 ||
      parts[0] !== 'v1' ||
      !parts[1] ||
      !parts[2] ||
      !/^[\w-]+$/.test(parts[1]) ||
      !/^[\w-]+$/.test(parts[2])
    )
      return null
    const iv = Buffer.from(parts[1], 'base64url')
    const ciphertext = Buffer.from(parts[2], 'base64url')
    if (iv.length !== 12 || encode(iv) !== parts[1] || encode(ciphertext) !== parts[2]) return null
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      await key(secret),
      ciphertext,
    )
    return JSON.parse(new TextDecoder().decode(plain)) as T
  } catch {
    return null
  }
}
