import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const form = readFileSync('components/tests/TestForm.tsx', 'utf8')
const attachments = readFileSync('components/tests/TestDocuments.tsx', 'utf8')
const route = readFileSync('app/api/admin/tests/[id]/documents/route.ts', 'utf8')
const itemRoute = readFileSync('app/api/admin/tests/[id]/documents/[docId]/route.ts', 'utf8')

assert.match(form, /related_doc_access/, 'linked quality documents need an access setting in section G')
assert.match(form, /visibility/, 'linked quality documents need visibility awareness in section G')
assert.match(attachments, /access_mode/, 'direct attachments need an access selector')
assert.match(attachments, /visibility/, 'direct attachments need a visibility selector')
assert.match(route, /access_mode/, 'direct attachment upload API must persist access mode')
assert.match(itemRoute, /export async function PATCH/, 'direct attachment API must update settings after upload')

console.log('test document access form tests passed')
