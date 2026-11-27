import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const KEY_INFO = 'mobibi:campaigner-refresh-token'
const IV_BYTES = 12
const TAG_BYTES = 16

const deriveKey = (secret: string): Buffer =>
  Buffer.from(hkdfSync('sha256', secret, '', KEY_INFO, 32))

export const encryptSecret = (plain: string, secret: string): string => {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export const decryptSecret = (sealed: string, secret: string): string => {
  const parts = sealed.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed sealed secret')
  }
  const iv = Buffer.from(parts[1], 'base64url')
  const tag = Buffer.from(parts[2], 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Malformed sealed secret')
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv, {
    authTagLength: TAG_BYTES,
  })
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
