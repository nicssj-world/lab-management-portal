import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(protected)/staff/tests/[id]/edit/page.tsx', 'utf8')

assert.match(source, /related_doc_ids:\s*test\.related_doc_ids/, 'edit form must restore selected quality-library document IDs')
assert.match(source, /related_doc_access:\s*test\.related_doc_access/, 'edit form must restore each selected document action')
assert.match(source, /testId=\{Number\(id\)\}/, 'edit form must keep the saved test ID so direct attachments reload')

console.log('edit related documents tests passed')
