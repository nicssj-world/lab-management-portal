import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const detailApi = readFileSync('app/api/tests/[id]/route.ts', 'utf8')
assert.match(detailApi, /visibility.*Public/, 'public detail API must filter direct attachments to Public')
assert.match(detailApi, /status.*Published/, 'public detail API must filter library documents to Published')
assert.match(detailApi, /related_doc_access/, 'public detail API must include linked-document action settings')

const actionRoute = 'app/api/tests/[id]/document-actions/[source]/[docId]/route.ts'
assert.ok(existsSync(actionRoute), 'public document-action route must exist')
const actionApi = readFileSync(actionRoute, 'utf8')
assert.match(actionApi, /visibility.*Public/, 'public action route must reject Internal documents')
assert.match(actionApi, /canUseDocumentAction/, 'public action route must reject an unavailable action')

console.log('public test document access tests passed')
