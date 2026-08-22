import 'server-only'

import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'

export interface ChemicalSdsR2CleanupResult {
  deletedKeys: string[]
  failedKeys: string[]
}

export async function deleteChemicalSdsR2Objects(
  keys: readonly string[],
): Promise<ChemicalSdsR2CleanupResult> {
  const uniqueKeys = [...new Set(keys.filter(key => key.length > 0))]
  const results = await Promise.all(uniqueKeys.map(async key => {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
      return { key, ok: true as const }
    } catch {
      return { key, ok: false as const }
    }
  }))

  return {
    deletedKeys: results.filter(result => result.ok).map(result => result.key),
    failedKeys: results.filter(result => !result.ok).map(result => result.key),
  }
}
