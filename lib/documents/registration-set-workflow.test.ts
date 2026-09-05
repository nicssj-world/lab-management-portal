import assert from 'node:assert/strict'
import test from 'node:test'
import { canMoveToStatus } from './workflow'
import {
  canInteractWithRegistrationSetRows,
  classifyRegistrationSetDocument,
  executeRegistrationSetPlan,
  planRegistrationSetTransition,
  type RegistrationSetWorkflowDocument,
  type RegistrationSetWorkflowInput,
} from './registration-set-workflow'

function document(overrides: Partial<RegistrationSetWorkflowDocument> = {}): RegistrationSetWorkflowDocument {
  return {
    id: 'doc-1',
    documentCode: 'FM-01',
    type: 'Form',
    status: 'Draft',
    fileUrl: 'documents/fm-01.pdf',
    sourcePdfUrl: null,
    wordUrl: null,
    description: null,
    ...overrides,
  }
}

function registrationSet(overrides: Partial<RegistrationSetWorkflowInput> = {}): RegistrationSetWorkflowInput {
  return {
    mainDocument: document({ id: 'main-1', documentCode: 'QP-01' }),
    members: [],
    ...overrides,
  }
}

test('missing official file blocks the entire plan before any mutation callback', async () => {
  const plan = planRegistrationSetTransition(registrationSet({
    mainDocument: document({ id: 'main-1', documentCode: 'FM-MAIN', fileUrl: null }),
    members: [{ document: document({ id: 'member-1', documentCode: 'FM-READY' }), activeDraft: null }],
  }))
  const calls: string[] = []

  const result = await executeRegistrationSetPlan(plan, async (target) => {
    calls.push(target.documentCode)
  })

  assert.equal(plan.blocker?.documentCode, 'FM-MAIN')
  assert.equal(plan.blocker?.reason, 'ต้องมีไฟล์ทางการก่อนส่งเข้า Review')
  assert.deepEqual(calls, [])
  assert.equal(result.failed?.documentCode, 'FM-MAIN')
})

test('QP/WI preflight mirrors canMoveToStatus source and PDF requirements', () => {
  const missingSource = document({ type: 'QP', documentCode: 'QP-MAIN', fileUrl: null, sourcePdfUrl: 'content.pdf', wordUrl: null })
  const missingPdf = document({ type: 'WI', documentCode: 'WI-MAIN', fileUrl: null, sourcePdfUrl: null, wordUrl: 'source.docx' })
  const ready = document({ type: 'QP', documentCode: 'QP-MAIN', fileUrl: null, sourcePdfUrl: 'content.pdf', wordUrl: 'source.docx' })

  const sourcePlan = planRegistrationSetTransition(registrationSet({ mainDocument: missingSource }))
  const pdfPlan = planRegistrationSetTransition(registrationSet({ mainDocument: missingPdf }))
  const readyPlan = planRegistrationSetTransition(registrationSet({ mainDocument: ready }))

  assert.equal(sourcePlan.blocker?.reason, canMoveToStatus({
    type: missingSource.type,
    status: missingSource.status,
    file_url: missingSource.fileUrl,
    source_pdf_url: missingSource.sourcePdfUrl,
    word_url: missingSource.wordUrl,
  }, 'Review').error)
  assert.equal(pdfPlan.blocker?.reason, canMoveToStatus({
    type: missingPdf.type,
    status: missingPdf.status,
    file_url: missingPdf.fileUrl,
    source_pdf_url: missingPdf.sourcePdfUrl,
    word_url: missingPdf.wordUrl,
  }, 'Review').error)
  assert.equal(readyPlan.blocker, null)
})

test('publishing a set blocks a QP/WI document with a missing change description before mutation', async () => {
  const missingDescription = Object.assign(document({
    id: 'main-1',
    documentCode: 'QP-MAIN',
    type: 'QP',
    status: 'Approved',
    fileUrl: 'content.pdf',
    sourcePdfUrl: 'content.pdf',
    wordUrl: 'source.docx',
  }), { description: '   ' })
  const plan = planRegistrationSetTransition(registrationSet({ mainDocument: missingDescription }))
  const calls: string[] = []

  const result = await executeRegistrationSetPlan(plan, async (target) => {
    calls.push(target.documentCode)
  })

  assert.equal(plan.nextStatus, 'Published')
  assert.equal(plan.blocker?.documentCode, 'QP-MAIN')
  assert.equal(plan.blocker?.reason, 'QP/WI ต้องระบุรายละเอียดการแก้ไขก่อนเผยแพร่')
  assert.deepEqual(calls, [])
  assert.equal(result.failed?.documentCode, 'QP-MAIN')
})

test('publishing a set ignores missing change descriptions for Reference members', () => {
  const referenceMember = Object.assign(document({
    id: 'reference-1',
    documentCode: 'RF-01',
    type: 'Reference',
    status: 'Approved',
    fileUrl: 'reference.pdf',
  }), { description: null })
  const main = Object.assign(document({
    id: 'main-1',
    documentCode: 'QP-MAIN',
    type: 'QP',
    status: 'Approved',
    fileUrl: 'content.pdf',
    sourcePdfUrl: 'content.pdf',
    wordUrl: 'source.docx',
  }), { description: 'ประกาศใช้ครั้งแรกทั้งฉบับ' })

  const plan = planRegistrationSetTransition(registrationSet({
    mainDocument: main,
    members: [{ document: referenceMember, activeDraft: null }],
  }))

  assert.equal(plan.blocker, null)
  assert.deepEqual(plan.targets.map((target) => target.documentCode), ['RF-01', 'QP-MAIN'])
})

test('publishing a set checks the working revision description instead of the Published parent', () => {
  const parent = document({
    id: 'published-1',
    documentCode: 'QP-REV',
    type: 'QP',
    status: 'Published',
    fileUrl: 'parent.pdf',
    sourcePdfUrl: 'parent.pdf',
    wordUrl: 'parent.docx',
    description: 'รายละเอียดของ Rev.เดิม',
  })
  const plan = planRegistrationSetTransition(registrationSet({
    members: [{
      setMode: 'revision',
      document: parent,
      activeDraft: {
        id: 'draft-1',
        documentId: parent.id,
        type: 'QP',
        status: 'Approved',
        fileUrl: 'revision.pdf',
        sourcePdfUrl: 'revision.pdf',
        wordUrl: 'revision.docx',
        description: null,
      },
    }],
    mainDocument: document({
      id: 'main-1',
      documentCode: 'FM-MAIN',
      status: 'Approved',
      fileUrl: 'main.pdf',
    }),
  }))

  assert.equal(plan.blocker?.documentCode, 'QP-REV')
  assert.equal(plan.blocker?.reason, 'QP/WI ต้องระบุรายละเอียดการแก้ไขก่อนเผยแพร่')
})

test('linked Published and already-target members are skipped', () => {
  const plan = planRegistrationSetTransition(registrationSet({
    members: [
      { document: document({ id: 'linked-1', documentCode: 'FM-LINK', status: 'Published' }), activeDraft: null },
      { document: document({ id: 'review-1', documentCode: 'FM-REVIEW', status: 'Review' }), activeDraft: null },
      { document: document({ id: 'draft-1', documentCode: 'FM-DRAFT' }), activeDraft: null },
    ],
  }))

  assert.equal(plan.blocker, null)
  assert.deepEqual(plan.targets.map((target) => target.documentCode), ['FM-DRAFT', 'QP-01'])
})

test('active draft target uses the server-returned revision-draft route', () => {
  const plan = planRegistrationSetTransition(registrationSet({
    members: [{
      document: document({ id: 'published-1', documentCode: 'WI-02', status: 'Published' }),
      activeDraft: {
        id: 'draft-9',
        documentId: 'draft-parent-9',
        type: 'WI',
        status: 'Draft',
        fileUrl: null,
        sourcePdfUrl: 'revision-content.pdf',
        wordUrl: 'revision-source.docx',
        description: null,
      },
    }],
  }))

  assert.equal(plan.blocker, null)
  assert.equal(plan.targets[0]?.kind, 'revision-draft')
  assert.equal(plan.targets[0]?.endpoint, '/api/admin/documents/draft-parent-9/revision-drafts/draft-9')
})

test('linked mode skips a target even when an unrelated active draft exists', () => {
  const plan = planRegistrationSetTransition(registrationSet({
    members: [{
      setMode: 'linked',
      document: document({ id: 'linked-1', documentCode: 'RF-LINK', status: 'Obsolete' }),
      activeDraft: {
        id: 'unrelated-draft', documentId: 'linked-1', type: 'Reference', status: 'Draft',
        fileUrl: 'unrelated.pdf', sourcePdfUrl: null, wordUrl: null,
        description: null,
      },
    }],
  }))

  assert.equal(plan.blocker, null)
  assert.deepEqual(plan.targets.map((target) => target.documentCode), ['QP-01'])
})

test('registered mode follows the document row and ignores unrelated drafts', () => {
  const plan = planRegistrationSetTransition(registrationSet({
    members: [{
      setMode: 'registered',
      document: document({ id: 'registered-1', documentCode: 'FM-REGISTERED', status: 'Draft' }),
      activeDraft: {
        id: 'unrelated-draft', documentId: 'registered-1', type: 'Form', status: 'Approved',
        fileUrl: 'unrelated.pdf', sourcePdfUrl: null, wordUrl: null,
        description: null,
      },
    }],
  }))

  assert.equal(plan.blocker, null)
  assert.equal(plan.targets[0]?.kind, 'document')
  assert.equal(plan.targets[0]?.documentCode, 'FM-REGISTERED')
})

test('actual member mutations are ordered before the main document', () => {
  const plan = planRegistrationSetTransition(registrationSet({
    members: [
      { document: document({ id: 'member-1', documentCode: 'FM-01' }), activeDraft: null },
      { document: document({ id: 'member-2', documentCode: 'FM-02' }), activeDraft: null },
    ],
  }))

  assert.deepEqual(plan.targets.map((target) => [target.documentCode, target.isMain]), [
    ['FM-01', false],
    ['FM-02', false],
    ['QP-01', true],
  ])
})

test('member mutation failure stops before the main document', async () => {
  const plan = planRegistrationSetTransition(registrationSet({
    members: [
      { document: document({ id: 'member-1', documentCode: 'FM-01' }), activeDraft: null },
      { document: document({ id: 'member-2', documentCode: 'FM-02' }), activeDraft: null },
    ],
  }))
  const calls: string[] = []

  const result = await executeRegistrationSetPlan(plan, async (target) => {
    calls.push(target.documentCode)
    if (target.documentCode === 'FM-02') throw new Error('blocked by handler')
  })

  assert.deepEqual(calls, ['FM-01', 'FM-02'])
  assert.deepEqual(result.succeeded.map((target) => target.documentCode), ['FM-01'])
  assert.equal(result.failed?.documentCode, 'FM-02')
  assert.equal(result.failed?.reason, 'blocked by handler')
})

test('set document classification distinguishes main refreshes from member refreshes', () => {
  const mainIds = new Set(['main-1'])
  const memberIds = new Set(['member-1'])

  assert.equal(classifyRegistrationSetDocument('main-1', mainIds, memberIds), 'main')
  assert.equal(classifyRegistrationSetDocument('member-1', mainIds, memberIds), 'member')
  assert.equal(classifyRegistrationSetDocument('other-1', mainIds, memberIds), null)
})

test('Reviewer rows are read-only while Admin and DCC rows are interactive', () => {
  assert.equal(canInteractWithRegistrationSetRows(undefined, 'Reviewer'), false)
  assert.equal(canInteractWithRegistrationSetRows('Reviewer', undefined), false)
  assert.equal(canInteractWithRegistrationSetRows('Admin', undefined), true)
  assert.equal(canInteractWithRegistrationSetRows(undefined, 'Document Controller'), true)
})
