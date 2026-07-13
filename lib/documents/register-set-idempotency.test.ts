import assert from 'node:assert/strict'
import {
  classifyRegisterRetry,
  hasMatchingFileKey,
  hasMatchingSourceKey,
  type RegisteredRetryDocument,
} from './register-set-idempotency'
import type { RegisterSetItem } from '@/lib/validations/document-set'

const item: Extract<RegisterSetItem, { kind: 'register' }> = {
  kind: 'register',
  file: { key: 'documents/form/2569/stable.pdf', name: 'Fm-QP-01.pdf', size: 123, mime: 'application/pdf' },
  document_code: 'FM-QP-01',
  title: 'แบบฟอร์มทดสอบ',
  type: 'Form',
  department: 'กลุ่มงานเทคนิคการแพทย์',
  revision: '1',
  owner_name: 'Owner',
  reviewer_name: 'Reviewer',
  approver_name: 'Approver',
  edit_date: '2026-07-13',
  effective_date: '2026-07-14',
  visibility: 'Internal',
}

const document: RegisteredRetryDocument = {
  id: 'member-1',
  document_code: item.document_code,
  title: item.title,
  type: item.type,
  department: item.department,
  revision: item.revision,
  status: 'Draft',
  visibility: item.visibility,
  owner_id: 'actor-1',
  owner_name: item.owner_name,
  reviewer_name: item.reviewer_name,
  approver_name: item.approver_name,
  edit_date: item.edit_date,
  effective_date: item.effective_date,
  word_url: null,
  pending_file_url: item.file.key,
  deleted_at: null,
}

assert.equal(classifyRegisterRetry({
  document, item, actorId: 'actor-1', mainDocumentId: 'main-1', setLinkMainIds: ['main-1'], fileKind: 'pdf',
}), 'linked-retry', 'same set link and stable file key should be an idempotent retry')

assert.equal(classifyRegisterRetry({
  document, item, actorId: 'actor-1', mainDocumentId: 'main-1', setLinkMainIds: [], fileKind: 'pdf',
}), 'stranded-retry', 'same-actor exact Draft with no set link should be safely completable')

assert.equal(classifyRegisterRetry({
  document, item: { ...item, file: { ...item.file, key: 'documents/form/2569/other.pdf' } }, actorId: 'actor-1', mainDocumentId: 'main-1', setLinkMainIds: ['main-1'], fileKind: 'pdf',
}), 'conflict', 'same code with a different R2 key must not be accepted as idempotent')

assert.equal(classifyRegisterRetry({
  document, item, actorId: 'actor-1', mainDocumentId: 'main-1', setLinkMainIds: ['other-main'], fileKind: 'pdf',
}), 'conflict', 'a member already assigned to another set must not be adopted')

assert.equal(classifyRegisterRetry({
  document, item, actorId: 'other-actor', mainDocumentId: 'main-1', setLinkMainIds: [], fileKind: 'pdf',
}), 'conflict', 'an unrelated owner cannot complete a stranded-looking item')

assert.equal(classifyRegisterRetry({
  document, item, actorId: 'other-actor', mainDocumentId: 'main-1', setLinkMainIds: ['main-1'], fileKind: 'pdf',
}), 'conflict', 'a current-set link must not bypass actor identity')

assert.equal(classifyRegisterRetry({
  document: { ...document, status: 'Review' }, item, actorId: 'actor-1', mainDocumentId: 'main-1', setLinkMainIds: ['main-1'], fileKind: 'pdf',
}), 'conflict', 'a current-set link must not bypass expected Draft status')

const metadataMismatches: Array<[keyof RegisteredRetryDocument, string | null]> = [
  ['document_code', 'FM-QP-OTHER'],
  ['title', 'changed title'],
  ['type', 'Reference'],
  ['department', 'other department'],
  ['revision', '2'],
  ['visibility', 'Public'],
  ['owner_name', 'other owner'],
  ['reviewer_name', 'other reviewer'],
  ['approver_name', 'other approver'],
  ['edit_date', '2026-08-01'],
  ['effective_date', '2026-08-02'],
]
for (const [field, value] of metadataMismatches) {
  assert.equal(classifyRegisterRetry({
    document: { ...document, [field]: value },
    item,
    actorId: 'actor-1',
    mainDocumentId: 'main-1',
    setLinkMainIds: ['main-1'],
    fileKind: 'pdf',
  }), 'conflict', `a current-set link must not bypass mismatched ${field}`)
}

assert.equal(hasMatchingFileKey({ file_url: item.file.key }, item.file.key), true)
assert.equal(hasMatchingFileKey({ file_url: item.file.key }, 'other-key'), false)
assert.equal(hasMatchingSourceKey({ word_url: 'stable-source.docx' }, 'stable-source.docx'), true)
