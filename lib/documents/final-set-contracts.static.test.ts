// Static route-shape checks only. Runtime database/R2 behavior requires an integration environment.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')
const presign = read('app/api/admin/documents/presign-file/route.ts')
const register = read('app/api/admin/documents/[id]/register-set/route.ts')
const central = read('app/api/admin/documents/[id]/route.ts')
const linksDelete = read('app/api/admin/documents/[id]/links/[linkId]/route.ts')
const pending = read('lib/documents/pending.ts')
const setZip = read('app/api/admin/documents/[id]/set-zip/route.ts')
const purge = read('lib/documents/ephemeral-attachments.ts')

assert.match(presign, /mainDocumentId/)
assert.match(presign, /setItemKind/)
assert.match(presign, /crypto\.randomUUID\(\)/)
assert.match(presign, /from\('document_set_uploads'\)[\s\S]*\.insert\(/)
assert.match(presign, /cleanupExpiredSetUploads/)

assert.match(register, /new HeadObjectCommand/)
assert.match(register, /validateSetUploadClaim/)
assert.match(register, /markSetUploadClaimed/)
assert.match(register, /setLink\(mainDocumentId, existingDocumentId, actor, 'linked'\)/)
assert.match(register, /setLink\(mainDocumentId, document\.id, actor, 'registered'\)/)
assert.match(register, /setLink\(mainDocumentId, current\.id, actor, 'revision', draft\.id\)/)

assert.match(central, /getRegistrationSetTransitionBlocker/)
assert.match(central, /findActiveRegistrationSet/)
assert.match(linksDelete, /link\.link_kind === 'set'/)

assert.match(pending, /set_mode, set_draft_id/)
assert.match(pending, /selectRegistrationSetDraft/)
assert.match(setZip, /set_mode, set_draft_id/)
assert.match(setZip, /selectRegistrationSetDraft/)

assert.match(purge, /isEphemeralSetStorageKey/)
assert.match(purge, /deletedObjectIds/)
assert.doesNotMatch(purge, /\.catch\(\(\) => \{\}\)/)
