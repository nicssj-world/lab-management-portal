import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function createCheckoutSecret(): string {
  return randomBytes(32).toString('base64url')
}

export function hashCheckoutSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex')
}

export function safeSecretEqual(left: string, right: string): boolean {
  const leftHash = Buffer.from(hashCheckoutSecret(left), 'hex')
  const rightHash = Buffer.from(hashCheckoutSecret(right), 'hex')
  return timingSafeEqual(leftHash, rightHash)
}
