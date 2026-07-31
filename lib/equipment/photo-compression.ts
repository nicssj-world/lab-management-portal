'use client'

export const MAX_EQUIPMENT_PHOTO_DIMENSION = 2048
const TARGET_EQUIPMENT_PHOTO_BYTES = 2 * 1024 * 1024
const MIN_EQUIPMENT_PHOTO_DIMENSION = 960
const JPEG_QUALITY = 0.82

export type CompressedEquipmentPhoto = {
  file: File
  originalBytes: number
  compressedBytes: number
}

export type EquipmentPhotoCompressionOptions = {
  onProgress?: (percent: number) => void
}

function loadImage(source: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('ไม่สามารถอ่านรูปนี้ได้ กรุณาเลือกภาพ JPEG, PNG หรือ WebP'))
    }
    image.src = url
  })
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('ไม่สามารถลดขนาดรูปได้ กรุณาลองใหม่'))
    }, 'image/jpeg', quality)
  })
}

function optimizedName(source: File) {
  const base = source.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'equipment-photo'}-optimized.jpg`
}

/** Compress a camera/gallery photo in the browser before it is uploaded to R2. */
export async function compressEquipmentPhoto(
  source: File,
  { onProgress }: EquipmentPhotoCompressionOptions = {},
): Promise<CompressedEquipmentPhoto> {
  if (!source.type.startsWith('image/')) throw new Error('กรุณาเลือกรูปภาพ')

  onProgress?.(5)
  const image = await loadImage(source)
  onProgress?.(20)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('รูปนี้ไม่มีขนาดภาพที่ใช้งานได้')

  const initialScale = Math.min(1, MAX_EQUIPMENT_PHOTO_DIMENSION / Math.max(sourceWidth, sourceHeight))
  let width = Math.max(1, Math.round(sourceWidth * initialScale))
  let height = Math.max(1, Math.round(sourceHeight * initialScale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('เบราว์เซอร์นี้ไม่รองรับการลดขนาดรูป')

  let encoded: Blob | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    onProgress?.(25 + attempt * 11)
    canvas.width = width
    canvas.height = height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    encoded = await encodeJpeg(canvas, Math.max(0.62, JPEG_QUALITY - attempt * 0.04))
    onProgress?.(Math.min(90, 40 + attempt * 11))
    if (encoded.size <= TARGET_EQUIPMENT_PHOTO_BYTES || Math.max(width, height) <= MIN_EQUIPMENT_PHOTO_DIMENSION) break
    width = Math.max(MIN_EQUIPMENT_PHOTO_DIMENSION, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * (width / canvas.width)))
  }

  if (!encoded) throw new Error('ไม่สามารถลดขนาดรูปได้ กรุณาลองใหม่')
  onProgress?.(100)
  return {
    file: new File([encoded], optimizedName(source), { type: 'image/jpeg', lastModified: source.lastModified }),
    originalBytes: source.size,
    compressedBytes: encoded.size,
  }
}
