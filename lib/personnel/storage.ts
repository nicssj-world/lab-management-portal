import { supabaseAdmin } from '@/lib/supabase/admin'

export const STAFF_BUCKET = 'staff-files'
export const MAX_STAFF_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

const EXT_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function staffFileExtForType(type: string): string | null {
  return EXT_BY_TYPE[type] ?? null
}

export function staffFileTypeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return TYPE_BY_EXT[ext] ?? 'application/octet-stream'
}

export async function ensureStaffBucket() {
  const { data } = await supabaseAdmin.storage.listBuckets()
  if (!data?.some((b) => b.id === STAFF_BUCKET)) {
    await supabaseAdmin.storage.createBucket(STAFF_BUCKET, { public: false })
  }
}

export async function uploadStaffFile(path: string, file: File): Promise<string> {
  await ensureStaffBucket()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabaseAdmin.storage
    .from(STAFF_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (error) throw error
  return path
}

export async function createStaffSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const { data } = await supabaseAdmin.storage.from(STAFF_BUCKET).createSignedUrl(path, 60 * 10)
  return data?.signedUrl ?? null
}

export async function downloadStaffFile(path: string): Promise<Blob> {
  const { data, error } = await supabaseAdmin.storage.from(STAFF_BUCKET).download(path)
  if (error || !data) throw error ?? new Error('ไม่พบไฟล์')
  return data
}

export async function removeStaffFile(path: string | null | undefined) {
  if (!path) return
  await supabaseAdmin.storage.from(STAFF_BUCKET).remove([path]).then(undefined, () => {})
}
