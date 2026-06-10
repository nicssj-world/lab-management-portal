const WINDOWS_RESERVED_CHARS = /[<>:"/\\|?*\x00-\x1F]/g

function extensionFrom(filename: string | null | undefined) {
  const clean = filename?.split(/[?#]/)[0] ?? ''
  const last = clean.split('/').pop() ?? ''
  const dot = last.lastIndexOf('.')
  if (dot <= 0 || dot === last.length - 1) return ''
  return last.slice(dot)
}

export function buildDocumentDownloadFilename(doc: {
  document_code?: string | null
  title?: string | null
  file_name?: string | null
}) {
  const base = [doc.document_code, doc.title]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ')
    || doc.file_name?.trim()
    || 'document'

  const ext = extensionFrom(doc.file_name)
  const withoutReserved = base.replace(WINDOWS_RESERVED_CHARS, ' ').replace(/\s+/g, ' ').trim()
  const filename = withoutReserved.toLowerCase().endsWith(ext.toLowerCase())
    ? withoutReserved
    : `${withoutReserved}${ext}`

  return filename || 'document'
}

export function contentDispositionForDownload(filename: string) {
  const fallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .trim()
    || 'document'

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export function contentDispositionForInline(filename: string) {
  const fallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .trim()
    || 'document'

  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
