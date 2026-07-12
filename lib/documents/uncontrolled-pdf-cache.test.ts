import assert from 'node:assert/strict'
import {
  resolveUncontrolledPdf,
  type UncontrolledPdfCacheDependencies,
} from './uncontrolled-pdf-cache'

const document = {
  id: 'doc-1',
  file_url: 'documents/qp/2026/source.pdf',
  file_name: 'QP-LAB-01.pdf',
  mime_type: 'application/pdf',
  type: 'QP',
  status: 'Published',
}

const objects = new Map<string, { bytes: Uint8Array; metadata: Record<string, string> }>()
let transformCalls = 0

const store: UncontrolledPdfCacheDependencies = {
  async head(key) {
    const object = objects.get(key)
    return object ? { size: object.bytes.byteLength, metadata: object.metadata } : null
  },
  async get(key) {
    assert.equal(key, document.file_url)
    return new Uint8Array([1, 2, 3])
  },
  async put(key, bytes, metadata) {
    objects.set(key, { bytes, metadata })
  },
  async stamp(source, input) {
    transformCalls += 1
    return { bytes: new Uint8Array([...source, input.variant === 'preview' ? 4 : 5]) }
  },
}

const bangkokNoon = new Date('2026-07-12T05:00:00.000Z')
const nextBangkokDay = new Date('2026-07-13T05:00:00.000Z')

async function testCache() {
  const preview = await resolveUncontrolledPdf(document, 'preview', bangkokNoon, store)
  assert.deepEqual(preview, {
    key: 'documents/uncontrolled/doc-1/preview.pdf',
    cacheStatus: 'generated',
    downloadDate: null,
    size: 4,
  })
  assert.equal((await resolveUncontrolledPdf(document, 'preview', bangkokNoon, store)).cacheStatus, 'hit')

  const download = await resolveUncontrolledPdf(document, 'download', bangkokNoon, store)
  assert.deepEqual(download, {
    key: 'documents/uncontrolled/doc-1/download-current.pdf',
    cacheStatus: 'generated',
    downloadDate: '12/07/2026',
    size: 4,
  })
  assert.equal((await resolveUncontrolledPdf(document, 'download', nextBangkokDay, store)).cacheStatus, 'regenerated')
  assert.equal(transformCalls, 3)
}

void testCache()
