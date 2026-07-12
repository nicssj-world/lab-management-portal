import assert from 'node:assert/strict'
import {
  InvalidDeliveryVariantError,
  UnsupportedEligibleDocumentError,
  parseDeliveryVariant,
  resolveDownloadAudience,
  resolveServedKey,
} from './document-delivery-variant'

const document = {
  id: 'doc-1',
  file_url: 'documents/qp/2026/source.pdf',
  file_name: 'QP-LAB-01.pdf',
  mime_type: 'application/pdf',
  type: 'QP',
  status: 'Published',
}

assert.equal(parseDeliveryVariant(null), 'download')
assert.equal(parseDeliveryVariant('preview'), 'preview')
assert.throws(() => parseDeliveryVariant('print'), InvalidDeliveryVariantError)
assert.equal(resolveDownloadAudience({ publicRoute: true, actor: null }), 'public')
assert.equal(resolveDownloadAudience({ publicRoute: false, actor: { doc_role: 'Viewer' } }), 'viewer')
assert.equal(resolveDownloadAudience({ publicRoute: false, actor: { doc_role: 'Document Controller' } }), 'staff')
async function testSelection() {
  const viewer = await resolveServedKey({
    document,
    audience: 'viewer',
    variant: 'preview',
    now: new Date('2026-07-12T05:00:00.000Z'),
    resolveUncontrolled: async () => ({ key: 'documents/uncontrolled/doc-1/preview.pdf' }),
  })
  assert.deepEqual(viewer, { key: 'documents/uncontrolled/doc-1/preview.pdf', uncontrolled: true })

  const staff = await resolveServedKey({
    document,
    audience: 'staff',
    variant: 'download',
    now: new Date('2026-07-12T05:00:00.000Z'),
    resolveUncontrolled: async () => {
      throw new Error('staff must not create a derivative')
    },
  })
  assert.deepEqual(staff, { key: document.file_url, uncontrolled: false })

  await assert.rejects(
    () => resolveServedKey({
      document: { ...document, file_name: 'QP-LAB-01.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      audience: 'public',
      variant: 'download',
      now: new Date('2026-07-12T05:00:00.000Z'),
    }),
    UnsupportedEligibleDocumentError,
  )
}

void testSelection()
