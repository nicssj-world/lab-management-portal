'use client'

/**
 * รูปจากกล้องโทรศัพท์มักมีขนาด 4–20 MB ขึ้นไป จึงลดด้านยาว, คุณภาพ และตัด EXIF
 * ก่อนขอ presigned URL เพื่อให้การส่งหลักฐานทำได้เร็วขึ้นบนเครือข่ายหน้างาน
 * ไฟล์ผลลัพธ์เป็น JPEG ซึ่ง Route Handler ของ safety module อนุญาตและตรวจ magic bytes ซ้ำอีกชั้น
 */
export const MAX_SAFETY_PHOTO_DIMENSION = 2048
const TARGET_SAFETY_PHOTO_BYTES = 2.5 * 1024 * 1024
const MIN_SAFETY_PHOTO_DIMENSION = 960

export type CompressedSafetyPhoto = {
  file: File
  originalBytes: number
  compressedBytes: number
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
      reject(new Error('ไม่สามารถอ่านรูปนี้ได้ กรุณาถ่ายใหม่หรือเลือกรูป JPEG, PNG หรือ WebP'))
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
  const base = source.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base || 'safety-photo'}-optimized.jpg`
}

export async function compressSafetyPhoto(source: File): Promise<CompressedSafetyPhoto> {
  if (!source.type.startsWith('image/')) throw new Error('กรุณาเลือกรูปถ่ายจากกล้องหรือคลังรูป')

  const image = await loadImage(source)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('รูปนี้ไม่มีขนาดภาพที่ใช้งานได้')

  const initialScale = Math.min(1, MAX_SAFETY_PHOTO_DIMENSION / Math.max(sourceWidth, sourceHeight))
  let width = Math.max(1, Math.round(sourceWidth * initialScale))
  let height = Math.max(1, Math.round(sourceHeight * initialScale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('เบราว์เซอร์นี้ไม่รองรับการลดขนาดรูป')

  let encoded: Blob | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    canvas.width = width
    canvas.height = height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    encoded = await encodeJpeg(canvas, Math.max(0.62, 0.84 - attempt * 0.05))
    if (encoded.size <= TARGET_SAFETY_PHOTO_BYTES || Math.max(width, height) <= MIN_SAFETY_PHOTO_DIMENSION) break
    width = Math.max(MIN_SAFETY_PHOTO_DIMENSION, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * (width / canvas.width)))
  }

  if (!encoded) throw new Error('ไม่สามารถลดขนาดรูปได้ กรุณาลองใหม่')
  return {
    file: new File([encoded], optimizedName(source), { type: 'image/jpeg', lastModified: source.lastModified }),
    originalBytes: source.size,
    compressedBytes: encoded.size,
  }
}
