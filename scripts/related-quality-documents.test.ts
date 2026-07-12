import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

async function main() {
  const helperPath = 'lib/documents/related-test-documents.ts'

  assert.ok(
    existsSync(helperPath),
    'test detail needs a helper to resolve quality documents referenced by related_doc_ids',
  )

  const { orderRelatedTestDocuments } = await import('../lib/documents/related-test-documents')

  const linked = orderRelatedTestDocuments(
    ['doc-b', 'doc-a', 'doc-missing', 'doc-b'],
    [
      { id: 'doc-a', document_code: 'WI-01', title: 'Work instruction', type: 'WI', file_url: 'wi.pdf', file_name: 'wi.pdf' },
      { id: 'doc-b', document_code: 'QP-02', title: 'Quality procedure', type: 'QP', file_url: 'qp.pdf', file_name: 'qp.pdf' },
      { id: 'doc-other', document_code: 'FM-03', title: 'Unlinked form', type: 'Form', file_url: 'form.pdf', file_name: 'form.pdf' },
    ],
  )

  assert.deepEqual(
    linked.map((doc) => doc.id),
    ['doc-b', 'doc-a'],
    'only selected quality documents should be returned, in the selected order without duplicates',
  )

  const querySource = readFileSync('lib/queries/tests.ts', 'utf8')
  assert.match(querySource, /getRelatedTestDocuments/, 'test detail query should load related quality documents')

  const detailPageSource = readFileSync('app/(protected)/staff/tests/[id]/page.tsx', 'utf8')
  assert.match(detailPageSource, /relatedDocuments/, 'staff test detail should render the linked quality documents')
  assert.match(detailPageSource, /QualityDocumentReadButton/, 'staff test detail should provide an action to open a linked quality document')

  console.log('related quality documents tests passed')
}

main()
