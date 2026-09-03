const DEFAULT_LOGO_URL = '/images/cbh-lab-logo-v3.png'
const DEFAULT_LOGO_RATIO = 0.2

type QrLogoOptions = {
  logoUrl?: string
  logoRatio?: number
}

const logoCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(source: string): Promise<HTMLImageElement> {
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`โหลดโลโก้ QR ไม่สำเร็จ: ${source}`))
    image.src = source
  })

  return promise
}

function loadLogo(source: string): Promise<HTMLImageElement> {
  const cached = logoCache.get(source)
  if (cached) return cached
  const promise = loadImage(source)
  logoCache.set(source, promise)
  return promise
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

/** Add the hospital logo to an already-generated QR without changing its encoded data. */
export async function addLogoToQrDataUrl(
  qrDataUrl: string,
  { logoUrl = DEFAULT_LOGO_URL, logoRatio = DEFAULT_LOGO_RATIO }: QrLogoOptions = {},
): Promise<string> {
  const qrImage = await loadImage(qrDataUrl)
  const logoImage = await loadLogo(logoUrl)
  const width = qrImage.naturalWidth || qrImage.width
  const height = qrImage.naturalHeight || qrImage.height

  if (!width || !height) throw new Error('QR Code ไม่มีขนาดภาพที่ใช้งานได้')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการสร้าง QR Code พร้อมโลโก้')

  context.drawImage(qrImage, 0, 0, width, height)

  const safeRatio = Math.min(Math.max(logoRatio, 0.12), 0.24)
  const logoSize = Math.round(Math.min(width, height) * safeRatio)
  const plateSize = Math.round(logoSize * 1.12)
  const plateX = Math.round((width - plateSize) / 2)
  const plateY = Math.round((height - plateSize) / 2)
  const logoX = Math.round((width - logoSize) / 2)
  const logoY = Math.round((height - logoSize) / 2)

  context.save()
  roundedRect(context, plateX, plateY, plateSize, plateSize, plateSize * 0.16)
  context.fillStyle = '#FFFFFF'
  context.fill()
  context.drawImage(logoImage, logoX, logoY, logoSize, logoSize)
  context.restore()

  return canvas.toDataURL('image/png')
}
