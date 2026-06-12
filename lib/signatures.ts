import { supabaseAdmin } from '@/lib/supabase/admin'

export const SIGNATURE_BUCKET = 'signatures'
export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function signatureExtForType(type: string) {
  return EXT_BY_TYPE[type] ?? null
}

export async function ensureSignatureBucket() {
  const { data } = await supabaseAdmin.storage.listBuckets()
  if (!data?.some(bucket => bucket.id === SIGNATURE_BUCKET)) {
    await supabaseAdmin.storage.createBucket(SIGNATURE_BUCKET, { public: false })
  }
}

export async function createSignatureSignedUrl(path: string | null | undefined) {
  if (!path) return null
  const { data } = await supabaseAdmin.storage
    .from(SIGNATURE_BUCKET)
    .createSignedUrl(path, 60 * 10)
  return data?.signedUrl ?? null
}

export async function downloadSignature(path: string | null | undefined) {
  if (!path) return null
  const { data, error } = await supabaseAdmin.storage.from(SIGNATURE_BUCKET).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}
