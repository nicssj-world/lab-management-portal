'use client'

import type { MapPrintDTO } from './print'

async function waitForAssets(element: HTMLElement) {
  await document.fonts.ready
  const qr = element.querySelector<HTMLElement>('[data-qr-state]')
  if (qr?.dataset.qrState === 'loading') {
    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (qr.dataset.qrState !== 'loading') {
          observer.disconnect()
          resolve()
        }
      })
      observer.observe(qr, { attributes: true, attributeFilter: ['data-qr-state'] })
    })
  }
  if (qr?.dataset.qrState === 'failed') throw new Error('สร้าง QR Code ไม่สำเร็จ')
  await Promise.all([...element.querySelectorAll('img')].map((image) => image.complete
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })))
}

function filename(dto: MapPrintDTO, extension: 'pdf' | 'png') {
  const safeVersion = dto.release.versionCode.replace(/[^A-Za-z0-9._-]+/g, '-')
  return `lab-map-${dto.kind}-${dto.map.stationCode}-${safeVersion}-${dto.paperSize}.${extension}`
}

function download(url: string, name: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
}

export async function exportMapAsPng(element: HTMLElement, dto: MapPrintDTO) {
  await waitForAssets(element)
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(element, { scale: dto.paperSize === 'A3' ? 2.5 : 3, useCORS: true, backgroundColor: '#ffffff' })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('สร้างไฟล์ PNG ไม่สำเร็จ')
  const url = URL.createObjectURL(blob)
  download(url, filename(dto, 'png'))
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportMapAsPdf(element: HTMLElement, dto: MapPrintDTO) {
  await waitForAssets(element)
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const canvas = await html2canvas(element, { scale: dto.paperSize === 'A3' ? 2.5 : 3, useCORS: true, backgroundColor: '#ffffff' })
  const dimensions = dto.paperSize === 'A3' ? [420, 297] as const : [297, 210] as const
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: dto.paperSize.toLowerCase() })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, dimensions[0], dimensions[1])
  pdf.save(filename(dto, 'pdf'))
}
