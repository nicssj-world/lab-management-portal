import assert from 'node:assert/strict'

import { buildPdfPageMetasFromFirstViewport, documentPdfProxyUrl, isPdfLike, shouldUsePdfJsViewer, viewerFileNameFromPath } from '../lib/pdf-viewer-utils'

assert.equal(isPdfLike({ fileName: 'manual.pdf' }), true)
assert.equal(isPdfLike({ fileName: 'MANUAL.PDF?token=abc' }), true)
assert.equal(isPdfLike({ mimeType: 'application/pdf' }), true)
assert.equal(isPdfLike({ mimeType: 'application/x-pdf' }), true)

assert.equal(isPdfLike({ fileName: 'form.docx' }), false)
assert.equal(isPdfLike({ fileName: 'sheet.xlsx' }), false)
assert.equal(isPdfLike({ fileName: 'photo.png', mimeType: 'image/png' }), false)
assert.equal(isPdfLike({ fileName: null, mimeType: null }), true)

assert.equal(viewerFileNameFromPath('staff/user/training/12345.pdf'), '12345.pdf')
assert.equal(viewerFileNameFromPath(''), 'document.pdf')

assert.deepEqual(buildPdfPageMetasFromFirstViewport(3, { width: 595, height: 842 }), [
  { pageNumber: 1, width: 595, height: 842 },
  { pageNumber: 2, width: 595, height: 842 },
  { pageNumber: 3, width: 595, height: 842 },
])
assert.deepEqual(buildPdfPageMetasFromFirstViewport(0, { width: 595, height: 842 }), [])

assert.equal(shouldUsePdfJsViewer({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 }), false)
assert.equal(shouldUsePdfJsViewer({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 }), false)
assert.equal(shouldUsePdfJsViewer({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }), true)
assert.equal(shouldUsePdfJsViewer({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }), true)
assert.equal(shouldUsePdfJsViewer({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0, forcePdfJs: true } as { userAgent: string; platform: string; maxTouchPoints: number; forcePdfJs: boolean }), true)

assert.equal(documentPdfProxyUrl('documents/generated/a b.pdf'), '/api/admin/documents/download?path=documents%2Fgenerated%2Fa%20b.pdf&variant=preview&inline=1&proxy=1')
assert.equal(documentPdfProxyUrl('documents/generated/a b.pdf', 'public'), '/api/documents/download?path=documents%2Fgenerated%2Fa%20b.pdf&variant=preview&inline=1&proxy=1')
assert.equal(documentPdfProxyUrl(null), null)

console.log('pdf-viewer tests passed')
