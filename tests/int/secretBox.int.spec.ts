import { describe, expect, it } from 'vitest'

import { decryptSecret, encryptSecret } from '@/lib/secretBox'

const SECRET = 'payload-secret-for-tests'
const PLAIN = 'refresh-token-123'

describe('secretBox', () => {
  it('round-trips the input', () => {
    expect(decryptSecret(encryptSecret(PLAIN, SECRET), SECRET)).toBe(PLAIN)
  })

  it('uses a fresh IV for each encryption', () => {
    expect(encryptSecret(PLAIN, SECRET)).not.toBe(encryptSecret(PLAIN, SECRET))
  })

  it('does not contain the plain text', () => {
    expect(encryptSecret(PLAIN, SECRET)).not.toContain(PLAIN)
  })

  it('throws when the ciphertext is altered', () => {
    const sealed = encryptSecret(PLAIN, SECRET)
    const parts = sealed.split('.')
    const ciphertext = parts[3]
    const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1)
    const tampered = [...parts.slice(0, 3), flipped].join('.')
    expect(() => decryptSecret(tampered, SECRET)).toThrow()
  })

  it('throws when decrypted with another secret', () => {
    const sealed = encryptSecret(PLAIN, SECRET)
    expect(() => decryptSecret(sealed, 'another-secret')).toThrow()
  })

  it('throws on a string that is not in the sealed format', () => {
    expect(() => decryptSecret('not-a-sealed-value', SECRET)).toThrow()
    expect(() => decryptSecret('v2.AAAA.AAAA.AAAA', SECRET)).toThrow()
  })
})
