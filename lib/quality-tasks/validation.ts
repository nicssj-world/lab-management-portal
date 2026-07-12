export const QUALITY_TASK_PDF_MAX_BYTES = 20 * 1024 * 1024

export function validatePdfMetadata(fileName: string, contentType: string, sizeBytes: number) {
  if (!fileName.toLowerCase().endsWith('.pdf') || contentType !== 'application/pdf') {
    return { ok: false as const, error: 'รองรับเฉพาะไฟล์ PDF' }
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1) return { ok: false as const, error: 'ไฟล์ว่างเปล่า' }
  if (sizeBytes > QUALITY_TASK_PDF_MAX_BYTES) return { ok: false as const, error: 'ไฟล์ PDF ใหญ่เกิน 20 MB' }
  return { ok: true as const }
}

export function isPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

export function safePdfName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(-120) || 'evidence.pdf'
}
