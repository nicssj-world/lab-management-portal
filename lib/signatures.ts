import { supabaseAdmin } from '@/lib/supabase/admin'
import sharp from 'sharp'

export const SIGNATURE_BUCKET = 'signatures'
export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024
export const NORMALIZED_SIGNATURE_WIDTH = 900
export const NORMALIZED_SIGNATURE_HEIGHT = 260
export const NORMALIZED_SIGNATURE_CONTENT_WIDTH = 820
export const NORMALIZED_SIGNATURE_CONTENT_HEIGHT = 170
export const NORMALIZED_SIGNATURE_CONTENT_TYPE = 'image/png'

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function signatureExtForType(type: string) {
  return EXT_BY_TYPE[type] ?? null
}

export async function normalizeSignatureImage(file: File) {
  const ext = signatureExtForType(file.type)
  if (!ext) throw new Error('รองรับเฉพาะ PNG, JPG หรือ WebP')
  if (file.size > MAX_SIGNATURE_BYTES) throw new Error('ไฟล์ลายเซ็นต้องไม่เกิน 2 MB')

  const input = Buffer.from(await file.arrayBuffer())
  const metadata = await sharp(input, { animated: false }).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error('อ่านขนาดไฟล์ลายเซ็นไม่สำเร็จ')
  }
  if (metadata.height > metadata.width * 1.6) {
    throw new Error('ลายเซ็นควรเป็นภาพแนวนอน กรุณา crop ให้เหลือเฉพาะลายเซ็นก่อนอัปโหลด')
  }

  const trimmed = await sharp(input, { animated: false })
    .rotate()
    .trim({ threshold: 18 })
    .png()
    .toBuffer()
    .catch(() => sharp(input, { animated: false }).rotate().png().toBuffer())

  const fitted = await sharp(trimmed)
    .resize({
      width: NORMALIZED_SIGNATURE_CONTENT_WIDTH,
      height: NORMALIZED_SIGNATURE_CONTENT_HEIGHT,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()

  const output = await sharp({
    create: {
      width: NORMALIZED_SIGNATURE_WIDTH,
      height: NORMALIZED_SIGNATURE_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: fitted, gravity: 'center' }])
    .png()
    .toBuffer()

  return {
    buffer: output,
    contentType: NORMALIZED_SIGNATURE_CONTENT_TYPE,
    ext: 'png',
    width: NORMALIZED_SIGNATURE_WIDTH,
    height: NORMALIZED_SIGNATURE_HEIGHT,
  }
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
