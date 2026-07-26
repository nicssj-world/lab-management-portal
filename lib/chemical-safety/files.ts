export const CHEMICAL_PDF_MIN_BYTES = 1 * 1024 * 1024
export const CHEMICAL_PDF_MAX_BYTES = 50 * 1024 * 1024

export type ChemicalPdfValidationResult =
  | { ok: true }
  | { ok: false; error: string }

export interface ChemicalPdfValidationInput {
  fileName: string
  contentType: string
  sizeBytes: number
  signature: Uint8Array
}

export function isPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d
}

export function validateChemicalPdf(input: ChemicalPdfValidationInput): ChemicalPdfValidationResult
export function validateChemicalPdf(
  fileName: string,
  contentType: string,
  sizeBytes: number,
  signature: Uint8Array,
): ChemicalPdfValidationResult
export function validateChemicalPdf(
  inputOrFileName: ChemicalPdfValidationInput | string,
  contentType?: string,
  sizeBytes?: number,
  signature?: Uint8Array,
): ChemicalPdfValidationResult {
  const input = typeof inputOrFileName === 'string'
    ? { fileName: inputOrFileName, contentType: contentType ?? '', sizeBytes: sizeBytes ?? Number.NaN, signature: signature ?? new Uint8Array() }
    : inputOrFileName

  if (!input.fileName.toLowerCase().endsWith('.pdf') || input.contentType !== 'application/pdf') {
    return { ok: false, error: 'Only PDF files with application/pdf MIME type are accepted' }
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < CHEMICAL_PDF_MIN_BYTES) {
    return { ok: false, error: 'PDF files must be at least 1 MB' }
  }
  if (input.sizeBytes > CHEMICAL_PDF_MAX_BYTES) {
    return { ok: false, error: 'PDF files must not exceed 50 MB' }
  }
  if (!isPdfSignature(input.signature)) {
    return { ok: false, error: 'File content does not have a PDF signature' }
  }
  return { ok: true }
}

export function safeChemicalFilename(fileName: string): string {
  const sanitized = fileName
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9\u0E00-\u0E7F._-]/g, '_')
    .replace(/\.{2,}/g, '_')

  if (sanitized === '' || sanitized === '.' || sanitized === '..') return 'chemical-sds.pdf'
  return Array.from(sanitized).slice(-180).join('')
}

export const safeR2Filename = safeChemicalFilename

export function buildChemicalSourceKey(sha256: string, fileName: string): string {
  return `chemical-safety/sources/${normalizeSha256(sha256)}-${safeChemicalFilename(fileName)}`
}

export const buildChemicalSdsSourceKey = buildChemicalSourceKey

export function buildChemicalSdsImportKey(sha256: string): string {
  return `chemical-safety/imports/${normalizeSha256(sha256)}.pdf`
}

function normalizeSha256(value: string): string {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error('A valid SHA-256 digest is required for a chemical-safety R2 key')
  }
  return value.toLowerCase()
}
