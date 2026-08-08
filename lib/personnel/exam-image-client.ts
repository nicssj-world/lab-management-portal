import type { ExamImageView } from './exam'
import { EXAM_IMAGE_MAX_BYTES, EXAM_IMAGE_MAX_DIMENSION } from './exam-image-validation'

export type ExamImageSize = { width: number; height: number }
export type ExamImageCodec = {
  decode: (file: File) => Promise<ExamImageSize>
  encode: (file: File, width: number, height: number, quality: number) => Promise<Blob>
}
export type CompressedExamImage = { file: File; width: number; height: number; alt: string }
export type ExamImageUploadDeps = {
  fetcher?: typeof fetch
  compressor?: (file: File) => Promise<CompressedExamImage>
  idFactory?: () => string
}

export function fitExamImageSize(width: number, height: number, maxDimension: number): ExamImageSize {
  const longest = Math.max(width, height)
  if (longest <= maxDimension) return { width, height }
  const scale = maxDimension / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function imageAlt(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim()
  return withoutExtension || 'ภาพประกอบข้อสอบ'
}

function browserCodec(): ExamImageCodec {
  return {
    decode: async (file) => {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file)
        const size = { width: bitmap.width, height: bitmap.height }
        bitmap.close()
        return size
      }
      const url = URL.createObjectURL(file)
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const element = new Image()
          element.onload = () => resolve(element)
          element.onerror = () => reject(new Error('ไม่สามารถอ่านรูปภาพได้'))
          element.src = url
        })
        return { width: image.naturalWidth, height: image.naturalHeight }
      } finally {
        URL.revokeObjectURL(url)
      }
    },
    encode: async (file, width, height, quality) => {
      const url = URL.createObjectURL(file)
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const element = new Image()
          element.onload = () => resolve(element)
          element.onerror = () => reject(new Error('ไม่สามารถอ่านรูปภาพได้'))
          element.src = url
        })
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการบีบอัดรูปภาพ')
        context.drawImage(image, 0, 0, width, height)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
        if (!blob) throw new Error('ไม่สามารถบีบอัดรูปภาพได้')
        return blob
      } finally {
        URL.revokeObjectURL(url)
      }
    },
  }
}

export async function compressExamImage(file: File, codec: ExamImageCodec = browserCodec()): Promise<CompressedExamImage> {
  if (!file.type.startsWith('image/')) throw new Error('รองรับเฉพาะไฟล์รูปภาพ')
  const decoded = await codec.decode(file)
  if (decoded.width <= 0 || decoded.height <= 0) throw new Error('ไม่สามารถอ่านขนาดรูปภาพได้')

  let size = fitExamImageSize(decoded.width, decoded.height, EXAM_IMAGE_MAX_DIMENSION)
  const qualities = [0.82, 0.72, 0.62]
  for (let pass = 0; pass < 8; pass += 1) {
    for (const quality of qualities) {
      const blob = await codec.encode(file, size.width, size.height, quality)
      if (blob.size <= EXAM_IMAGE_MAX_BYTES) {
        return {
          file: new File([blob], `${imageAlt(file.name).replace(/\s+/g, '-') || 'exam-image'}.webp`, { type: 'image/webp' }),
          width: size.width,
          height: size.height,
          alt: imageAlt(file.name),
        }
      }
    }
    if (Math.max(size.width, size.height) <= 640) break
    const scale = 0.8
    const nextMaxDimension = Math.max(640, Math.round(Math.max(size.width, size.height) * scale))
    size = fitExamImageSize(size.width, size.height, nextMaxDimension)
  }
  throw new Error('ไม่สามารถลดขนาดรูปภาพให้ต่ำกว่า 2 MB ได้')
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({}))
  return data && typeof data === 'object' ? data as Record<string, unknown> : {}
}

export async function uploadExamImage(file: File, deps: ExamImageUploadDeps = {}): Promise<ExamImageView> {
  const compressed = await (deps.compressor ?? compressExamImage)(file)
  const fetcher = deps.fetcher ?? fetch
  const presignResponse = await fetcher('/api/admin/personnel/exams/images/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: compressed.file.type, sizeBytes: compressed.file.size }),
  })
  const presign = await responseJson(presignResponse)
  if (!presignResponse.ok) throw new Error(String(presign.error ?? 'เตรียมอัปโหลดรูปไม่สำเร็จ'))
  if (typeof presign.uploadUrl !== 'string' || typeof presign.key !== 'string' || typeof presign.readUrl !== 'string') {
    throw new Error('ข้อมูลอัปโหลดรูปไม่ครบถ้วน')
  }

  const putResponse = await fetcher(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': compressed.file.type },
    body: compressed.file,
  })
  if (!putResponse.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่')

  return {
    id: deps.idFactory?.() ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `image-${Date.now()}`),
    key: presign.key,
    url: presign.readUrl,
    alt: compressed.alt,
    width: compressed.width,
    height: compressed.height,
  }
}
