import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findRegistrationSetTransitionBlocker,
  isEphemeralSetStorageKey,
  registrationSetQueueExcludedIds,
  selectRegistrationSetDraft,
  validateSetUploadClaim,
  validateSetUploadFile,
  validateSetUploadObject,
} from './registration-set-contracts'

function validationError(result: { ok: true } | { ok: false; error: string }) {
  return result.ok ? '' : result.error
}

test('membership mode selects only the exact owned revision draft', () => {
  const drafts = new Map([
    ['owned-draft', { id: 'owned-draft', document_id: 'member-1', status: 'Draft' }],
    ['unrelated-draft', { id: 'unrelated-draft', document_id: 'member-1', status: 'Draft' }],
  ])

  assert.equal(selectRegistrationSetDraft({ set_mode: 'linked', set_draft_id: null, linked_doc_id: 'member-1' }, drafts), null)
  assert.equal(selectRegistrationSetDraft({ set_mode: 'registered', set_draft_id: null, linked_doc_id: 'member-1' }, drafts), null)
  assert.equal(
    selectRegistrationSetDraft({ set_mode: 'revision', set_draft_id: 'owned-draft', linked_doc_id: 'member-1' }, drafts)?.id,
    'owned-draft',
  )
  assert.throws(
    () => selectRegistrationSetDraft({ set_mode: 'revision', set_draft_id: 'missing', linked_doc_id: 'member-1' }, drafts),
    /missing/,
  )
})

test('main transition requires non-linked members and exact revision drafts at target', () => {
  const documents = new Map([
    ['registered-1', { id: 'registered-1', document_code: 'FM-01', status: 'Review' }],
    ['linked-1', { id: 'linked-1', document_code: 'RF-01', status: 'Published' }],
    ['revision-1', { id: 'revision-1', document_code: 'WI-01', status: 'Published' }],
  ])
  const drafts = new Map([
    ['draft-1', { id: 'draft-1', document_id: 'revision-1', status: 'Draft' }],
    ['draft-unrelated', { id: 'draft-unrelated', document_id: 'revision-1', status: 'Review' }],
  ])
  const links = [
    { set_mode: 'registered' as const, set_draft_id: null, linked_doc_id: 'registered-1' },
    { set_mode: 'linked' as const, set_draft_id: null, linked_doc_id: 'linked-1' },
    { set_mode: 'revision' as const, set_draft_id: 'draft-1', linked_doc_id: 'revision-1' },
  ]

  assert.deepEqual(findRegistrationSetTransitionBlocker(links, documents, drafts, 'Review'), {
    documentCode: 'WI-01',
    reason: 'working revision ยังอยู่ในสถานะ Draft (ต้องเป็น Review)',
  })
  drafts.set('draft-1', { id: 'draft-1', document_id: 'revision-1', status: 'Review' })
  assert.equal(findRegistrationSetTransitionBlocker(links, documents, drafts, 'Review'), null)
})

test('queue exclusions include both active set mains and members', () => {
  assert.deepEqual(
    registrationSetQueueExcludedIds([{ mainDocumentId: 'main-1', memberIds: ['member-1', 'member-2'] }]),
    new Set(['main-1', 'member-1', 'member-2']),
  )
})

test('ephemeral purge accepts only the exact set namespace', () => {
  assert.equal(isEphemeralSetStorageKey('main-1', 'documents/sets/main-1/2026/ticket-file.pdf'), true)
  assert.equal(isEphemeralSetStorageKey('main-1', 'documents/sets/main-10/2026/ticket-file.pdf'), false)
  assert.equal(isEphemeralSetStorageKey('main-1', 'documents/attachments/set/2026/legacy.pdf'), false)
  assert.equal(isEphemeralSetStorageKey('main-1', 'documents/sets/main-1/'), false)
})

test('upload claim matching enforces identity, namespace, metadata, expiry, and claimed retries', () => {
  const claim = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    document_id: 'main-1',
    actor_id: 'actor-1',
    upload_kind: 'register' as const,
    storage_key: 'documents/sets/main-1/2026/3e15d-file.pdf',
    file_name: 'file.pdf',
    file_size: 12,
    mime_type: 'application/pdf',
    expires_at: '2026-07-13T01:00:00.000Z',
    claimed_at: null,
  }
  const submission = {
    uploadId: claim.id,
    mainDocumentId: 'main-1',
    actorId: 'actor-1',
    uploadKind: 'register' as const,
    key: claim.storage_key,
    name: claim.file_name,
    size: claim.file_size,
    mime: claim.mime_type,
  }

  assert.equal(validateSetUploadClaim(claim, submission, new Date('2026-07-13T00:59:00.000Z'), false).ok, true)
  assert.match(validationError(validateSetUploadClaim({ ...claim, actor_id: 'actor-2' }, submission, new Date('2026-07-13T00:59:00.000Z'), false)), /actor/)
  assert.match(validationError(validateSetUploadClaim(claim, { ...submission, key: 'documents/sets/main-2/2026/file.pdf' }, new Date('2026-07-13T00:59:00.000Z'), false)), /key/)
  assert.match(validationError(validateSetUploadClaim(claim, submission, new Date('2026-07-13T01:00:00.000Z'), false)), /expired/)
  assert.match(validationError(validateSetUploadClaim({ ...claim, claimed_at: '2026-07-13T00:58:00.000Z' }, submission, new Date('2026-07-13T00:59:00.000Z'), false)), /claimed/)
  assert.equal(validateSetUploadClaim({ ...claim, claimed_at: '2026-07-13T00:58:00.000Z' }, submission, new Date('2026-07-13T00:59:00.000Z'), true).ok, true)
})

test('set file validation cross-checks extension, MIME, key, and requested document type', () => {
  assert.equal(validateSetUploadFile({
    uploadKind: 'register', documentType: 'Form', name: 'form.pdf', key: 'documents/sets/main-1/2026/id-form.pdf', mime: 'application/pdf',
  }).ok, true)
  assert.match(validationError(validateSetUploadFile({
    uploadKind: 'register', documentType: 'Form', name: 'form.pdf', key: 'documents/sets/main-1/2026/id-form.pdf', mime: 'text/plain',
  })), /MIME/)
  assert.match(validationError(validateSetUploadFile({
    uploadKind: 'register', documentType: 'Form', name: 'form.pdf', key: 'documents/sets/main-1/2026/id-form.docx', mime: 'application/pdf',
  })), /extension/)
  assert.match(validationError(validateSetUploadFile({
    uploadKind: 'revise-existing', documentType: 'QP', name: 'source.docx', key: 'documents/sets/main-1/2026/id-source.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })), /PDF/)
  assert.equal(validateSetUploadFile({
    uploadKind: 'attach', documentType: null, name: 'evidence.bin', key: 'documents/sets/main-1/2026/id-evidence.bin', mime: 'application/octet-stream',
  }).ok, true)
})

test('R2 HEAD verification requires exact size and reliable content type', () => {
  assert.equal(validateSetUploadObject(12, 'application/pdf', { contentLength: 12, contentType: 'application/pdf' }).ok, true)
  assert.match(validationError(validateSetUploadObject(12, 'application/pdf', { contentLength: 11, contentType: 'application/pdf' })), /size/)
  assert.match(validationError(validateSetUploadObject(12, 'application/pdf', { contentLength: 12, contentType: 'text/plain' })), /content type/)
  assert.equal(validateSetUploadObject(12, 'application/pdf', { contentLength: 12, contentType: 'application/octet-stream' }).ok, true)
})
