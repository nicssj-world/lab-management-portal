import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path)
  return createHash('sha256').update(bytes).digest('hex')
}

export async function assertSourceFile(path: string, expectedSha256: string): Promise<string> {
  const actualSha256 = await sha256File(path)
  if (actualSha256 !== expectedSha256.toLowerCase()) {
    throw new Error(`Source file SHA-256 mismatch: expected ${expectedSha256.toLowerCase()}, received ${actualSha256}`)
  }

  return actualSha256
}
