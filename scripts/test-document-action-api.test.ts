import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const route = 'app/api/admin/tests/[id]/document-actions/[source]/[docId]/route.ts'
assert.ok(existsSync(route), 'staff document-action route must exist')
const source = readFileSync(route, 'utf8')
assert.match(source, /canUseDocumentAction/, 'route must reject an unavailable action')
assert.match(source, /status: 403/, 'route must return forbidden for an unavailable action')
assert.match(source, /related_doc_ids/, 'library action must verify the document belongs to this test')
assert.match(source, /access_mode/, 'attachment action must use persisted access mode')

console.log('test document action API tests passed')
