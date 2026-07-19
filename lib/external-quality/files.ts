export const EXTERNAL_QUALITY_MAX_FILE_BYTES = 20 * 1024 * 1024

export type ExternalQualityFileKind = 'pdf' | 'image' | 'excel'

const MIME_KIND: Record<string, ExternalQualityFileKind> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
}

const MIME_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
}

export function fileKind(contentType: string): ExternalQualityFileKind | null {
  return MIME_KIND[contentType] ?? null
}

export function validateExternalQualityFile(fileName: string, contentType: string, sizeBytes: number) {
  const kind = fileKind(contentType)
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!kind || !MIME_EXTENSIONS[contentType]?.includes(ext)) {
    return { ok: false as const, error: 'รองรับเฉพาะ PDF, JPG, PNG, WEBP, XLS และ XLSX' }
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1) return { ok: false as const, error: 'ไฟล์ว่างเปล่า' }
  if (sizeBytes > EXTERNAL_QUALITY_MAX_FILE_BYTES) return { ok: false as const, error: 'ไฟล์ใหญ่เกิน 20 MB' }
  return { ok: true as const, kind }
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

export function isAllowedFileSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'application/pdf') return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
  if (contentType === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (contentType === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff])
  if (contentType === 'image/webp') {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  }
  if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
  }
  if (contentType === 'application/vnd.ms-excel') {
    return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])
  }
  return false
}

export function safeExternalQualityFileName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? 'file'
  const stem = name.slice(0, Math.max(0, name.length - ext.length - 1))
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(-100) || 'attachment'
  return `${stem}.${ext}`
}

