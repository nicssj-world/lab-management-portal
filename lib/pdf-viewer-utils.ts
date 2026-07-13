export function stripUrlDecorations(value: string) {
  return value.split(/[?#]/)[0] ?? value
}

export function isPdfLike(input: { fileName?: string | null; mimeType?: string | null }) {
  const mime = input.mimeType?.toLowerCase() ?? ''
  if (mime.includes('pdf')) return true

  const fileName = input.fileName?.trim()
  if (!fileName) return true

  return /\.pdf$/i.test(stripUrlDecorations(fileName))
}

export function viewerFileNameFromPath(path: string | null | undefined) {
  const clean = stripUrlDecorations(path ?? '')
  const name = clean.split('/').filter(Boolean).pop()
  return name || 'document.pdf'
}

export interface PdfPageMeta {
  pageNumber: number
  width: number
  height: number
}

// Each page can have its own size/orientation (e.g. a landscape page mixed into an
// otherwise-portrait document) — build metadata from every page's own viewport rather
// than assuming all pages share the first page's dimensions.
export function buildPdfPageMetasFromViewports(viewports: { width: number; height: number }[]): PdfPageMeta[] {
  return viewports.map((viewport, index) => ({
    pageNumber: index + 1,
    width: viewport.width,
    height: viewport.height,
  }))
}

export function shouldUsePdfJsViewer(input: { userAgent?: string | null; platform?: string | null; maxTouchPoints?: number | null; forcePdfJs?: boolean }) {
  if (input.forcePdfJs) return true
  const userAgent = input.userAgent ?? ''
  const platform = input.platform ?? ''
  if (/iPad|iPhone|iPod/i.test(userAgent) || /iPad|iPhone|iPod/i.test(platform)) return true

  // iPadOS can report itself as MacIntel while still exposing touch points.
  return platform === 'MacIntel' && (input.maxTouchPoints ?? 0) > 1
}

export function documentPdfProxyUrl(path: string | null | undefined, scope: 'admin' | 'public' = 'admin') {
  if (!path) return null
  const base = scope === 'public' ? '/api/documents/download' : '/api/admin/documents/download'
  return `${base}?path=${encodeURIComponent(path)}&variant=preview&inline=1&proxy=1`
}
