import 'server-only'

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { safeExternalQualityFileName } from '@/lib/external-quality/files'

export const SAFETY_PHOTO_MAX_BYTES = 10_485_760
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function validateSafetyPhoto(fileName: string, contentType: string, sizeBytes: number) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const expected = contentType === 'image/jpeg' ? ['jpg', 'jpeg'] : contentType === 'image/png' ? ['png'] : contentType === 'image/webp' ? ['webp'] : []
  if (!IMAGE_TYPES.includes(contentType as typeof IMAGE_TYPES[number]) || !extension || !expected.includes(extension)) {
    return { ok: false as const, error: 'รองรับเฉพาะรูป JPG, PNG และ WEBP' }
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1) return { ok: false as const, error: 'ไฟล์ว่างเปล่า' }
  if (sizeBytes > SAFETY_PHOTO_MAX_BYTES) return { ok: false as const, error: 'รูปใหญ่เกิน 10 MB' }
  return { ok: true as const }
}

export async function presignSafetyPhoto(prefix: string, fileName: string, contentType: string, sizeBytes: number) {
  const validation = validateSafetyPhoto(fileName, contentType, sizeBytes)
  if (!validation.ok) throw new Error(validation.error)
  const key = `${prefix}${crypto.randomUUID()}-${safeExternalQualityFileName(fileName)}`
  const uploadUrl = await getSignedUrl(r2, new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, ContentType: contentType,
  }), { expiresIn: 300 })
  return { key, uploadUrl }
}

export async function inspectUploadedSafetyPhoto(
  key: string,
  fileName: string,
  signatureCheck: (contentType: string, bytes: Uint8Array) => boolean,
) {
  const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const contentType = head.ContentType ?? ''
  const sizeBytes = Number(head.ContentLength ?? 0)
  const validation = validateSafetyPhoto(fileName, contentType, sizeBytes)
  if (!validation.ok) throw new Error(validation.error)
  const probe = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: 'bytes=0-11' }))
  const bytes = new Uint8Array(await probe.Body!.transformToByteArray())
  if (!signatureCheck(contentType, bytes)) throw new Error('เนื้อหาไฟล์ไม่ตรงกับชนิดรูป')
  return { contentType, sizeBytes }
}

export async function deleteSafetyPhoto(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
}

export async function loadSafetyPhoto(key: string, range?: string | null) {
  return r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: range ?? undefined }))
}

export { DeleteObjectCommand }
