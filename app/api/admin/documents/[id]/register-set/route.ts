import { NextRequest, NextResponse } from 'next/server'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { canAccessDocuments, getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { isPdfFile, isSourceFile, nextRevisionValue } from '@/lib/documents/workflow'
import {
  classifyRegisterRetry,
  hasMatchingFileKey,
  hasMatchingSourceKey,
  type RegisteredRetryDocument,
} from '@/lib/documents/register-set-idempotency'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RegisterSetSchema, type RegisterSetItem } from '@/lib/validations/document-set'
import {
  decideSetLinkConversion,
  validateSetUploadClaim,
  validateSetUploadFile,
  validateSetUploadObject,
  type RegistrationSetMode,
  type SetUploadClaimContract,
  type SetUploadKind,
} from '@/lib/documents/registration-set-contracts'
import { r2, R2_BUCKET } from '@/lib/r2/client'

type Params = { params: Promise<{ id: string }> }

// Keep the platform execution bound well below the 15-minute register lease so
// an interrupted invocation cannot hold a live lease for another full runtime.
export const maxDuration = 300

type ItemSuccess = {
  index: number
  kind: RegisterSetItem['kind']
  item: RegisterSetItem
  data: unknown
}

type ItemFailure = {
  index: number
  kind: RegisterSetItem['kind']
  item: RegisterSetItem
  error: string
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

function throwIfError(error: unknown) {
  if (error) throw error
}

function fileKind(file: { name: string; mime: string }) {
  const fileRef = { name: file.name, type: file.mime }
  if (isPdfFile(fileRef)) return 'pdf' as const
  if (isSourceFile(fileRef)) return 'source' as const
  throw new Error(`ไม่รองรับชนิดไฟล์ ${file.name}`)
}

async function findLink(documentId: string, linkedDocumentId: string) {
  const result = await supabaseAdmin
    .from('document_links')
    .select('id, document_id, linked_doc_id, link_kind, set_mode, set_draft_id')
    .eq('document_id', documentId)
    .eq('linked_doc_id', linkedDocumentId)
    .maybeSingle()
  throwIfError(result.error)
  return result.data
}

function assertMatchingSetLink(
  link: { link_kind: string; set_mode: string | null; set_draft_id: string | null },
  mode: RegistrationSetMode,
  draftId: string | null,
) {
  if (link.link_kind === 'set' && link.set_mode === mode && link.set_draft_id === draftId) return
  if (link.link_kind === 'set') {
    throw new Error(`เอกสารนี้เป็นสมาชิกชุดด้วยโหมด ${link.set_mode ?? 'ไม่ทราบ'} อยู่แล้ว`)
  }
}

async function setLink(
  documentId: string,
  linkedDocumentId: string,
  actor: Actor,
  mode: RegistrationSetMode,
  draftId: string | null = null,
) {
  if (documentId === linkedDocumentId) throw new Error('ไม่สามารถลิงก์เอกสารตัวเองได้')

  const existing = await findLink(documentId, linkedDocumentId)
  if (existing) {
    assertMatchingSetLink(existing, mode, draftId)
    if (existing.link_kind === 'set') return existing
    const desired = { link_kind: 'set', set_mode: mode, set_draft_id: draftId }
    const converted = await supabaseAdmin
      .from('document_links')
      .update(desired)
      .eq('id', existing.id)
      .eq('link_kind', 'related')
      .is('set_mode', null)
      .is('set_draft_id', null)
      .select()
      .maybeSingle()
    if (converted.error && converted.error.code !== '23505') throw converted.error
    const reread = converted.data ? null : await findLink(documentId, linkedDocumentId)
    if (decideSetLinkConversion({ updated: converted.data, reread }, desired) !== 'accepted') {
      if (converted.error?.code === '23505' && draftId) {
        throw new Error(`working revision ${draftId} เป็นสมาชิกของชุดเอกสารอื่นอยู่แล้ว`)
      }
      throw new Error('ลิงก์เอกสารถูกแก้ไขพร้อมกันด้วยโหมดอื่น กรุณาลองใหม่')
    }
    return converted.data ?? reread
  }

  const inserted = await supabaseAdmin
    .from('document_links')
    .insert({
      document_id: documentId,
      linked_doc_id: linkedDocumentId,
      link_kind: 'set',
      set_mode: mode,
      set_draft_id: draftId,
      created_by: actor.id,
    })
    .select()
    .single()

  if (!inserted.error) return inserted.data
  if (inserted.error.code !== '23505') throw inserted.error
  const raced = await findLink(documentId, linkedDocumentId)
  if (!raced) {
    if (draftId) throw new Error(`working revision ${draftId} เป็นสมาชิกของชุดเอกสารอื่นอยู่แล้ว`)
    throw inserted.error
  }
  if (raced.link_kind !== 'set') return setLink(documentId, linkedDocumentId, actor, mode, draftId)
  assertMatchingSetLink(raced, mode, draftId)
  return raced
}

async function requireDraftMainDocument(documentId: string) {
  const result = await supabaseAdmin
    .from('documents')
    .select('id, status')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfError(result.error)
  if (!result.data) throw new Error('ไม่พบเอกสารหลัก')
  if (result.data.status !== 'Draft') {
    throw new Error('ลงทะเบียนชุดเอกสารได้เฉพาะเอกสารหลักสถานะ Draft')
  }
  return result.data
}

async function linkExistingDocument(mainDocumentId: string, existingDocumentId: string, actor: Actor) {
  const targetResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, status')
    .eq('id', existingDocumentId)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfError(targetResult.error)
  if (!targetResult.data) throw new Error('ไม่พบเอกสารที่ต้องการเชื่อมโยง')
  if (targetResult.data.status !== 'Published') {
    throw new Error('เชื่อมโยงได้เฉพาะเอกสาร Published เท่านั้น')
  }

  const activeDraft = await supabaseAdmin
    .from('document_revision_drafts')
    .select('id')
    .eq('document_id', existingDocumentId)
    .is('cancelled_at', null)
    .neq('status', 'Published')
    .maybeSingle()
  throwIfError(activeDraft.error)
  if (activeDraft.data) {
    throw new Error(`เอกสาร ${targetResult.data.document_code} มี working revision ที่กำลังใช้งานอยู่ จึงลิงก์แบบ Published ไม่ได้`)
  }

  return {
    document: targetResult.data,
    link: await setLink(mainDocumentId, existingDocumentId, actor, 'linked'),
  }
}

const REGISTER_RETRY_COLUMNS = 'id, document_code, title, type, department, revision, status, visibility, owner_id, owner_name, reviewer_name, approver_name, edit_date, effective_date, word_url, pending_file_url, deleted_at'

async function findDocumentByCode(documentCode: string) {
  const result = await supabaseAdmin
    .from('documents')
    .select(REGISTER_RETRY_COLUMNS)
    .eq('document_code', documentCode)
    .maybeSingle()
  throwIfError(result.error)
  return result.data as RegisteredRetryDocument | null
}

async function reuseRegisteredDocument(
  mainDocumentId: string,
  document: RegisteredRetryDocument,
  item: Extract<RegisterSetItem, { kind: 'register' }>,
  actor: Actor,
  kind: 'pdf' | 'source',
) {
  const links = await supabaseAdmin
    .from('document_links')
    .select('id, document_id, set_mode, set_draft_id')
    .eq('linked_doc_id', document.id)
    .eq('link_kind', 'set')
  throwIfError(links.error)
  const classification = classifyRegisterRetry({
    document,
    item,
    actorId: actor.id,
    mainDocumentId,
    setLinkMainIds: (links.data ?? []).map((link) => link.document_id),
    fileKind: kind,
  })
  if (classification === 'linked-retry') {
    const link = links.data?.find((candidate) => candidate.document_id === mainDocumentId) ?? null
    if (link?.set_mode !== 'registered' || link.set_draft_id !== null) {
      throw new Error(`รหัสเอกสาร ${document.document_code} ถูกผูกกับชุดนี้ด้วยโหมดอื่นอยู่แล้ว`)
    }
    return { document, link, reused: true }
  }
  if (classification === 'stranded-retry') {
    return {
      document,
      link: await setLink(mainDocumentId, document.id, actor, 'registered'),
      reused: true,
      completedStranded: true,
    }
  }
  const state = document.deleted_at ? ' (ถูกลบแบบ soft-delete)' : ''
  throw new Error(`รหัสเอกสาร ${document.document_code} มีอยู่ในระบบแล้ว${state} (document_id: ${document.id})`)
}

async function findDocumentAttachment(mainDocumentId: string, fileKey: string) {
  const result = await supabaseAdmin
    .from('document_attachments')
    .select('*')
    .eq('document_id', mainDocumentId)
    .eq('file_url', fileKey)
    .maybeSingle()
  throwIfError(result.error)
  return result.data
}

async function findDraftAttachment(draftId: string, fileKey: string) {
  const result = await supabaseAdmin
    .from('document_revision_draft_attachments')
    .select('*')
    .eq('draft_id', draftId)
    .eq('file_url', fileKey)
    .maybeSingle()
  throwIfError(result.error)
  return result.data
}

async function registerDocument(mainDocumentId: string, item: Extract<RegisterSetItem, { kind: 'register' }>, actor: Actor) {
  const documentCode = item.document_code.trim().toUpperCase()
  const kind = fileKind(item.file)
  const duplicate = await findDocumentByCode(documentCode)
  if (duplicate) return reuseRegisteredDocument(mainDocumentId, duplicate, item, actor, kind)

  const fileFields = kind === 'source'
    ? {
        word_url: item.file.key,
        word_name: item.file.name,
        word_size: item.file.size,
      }
    : {
        pending_file_url: item.file.key,
        pending_file_name: item.file.name,
        pending_file_size: item.file.size,
        pending_file_mime: item.file.mime,
      }

  const inserted = await supabaseAdmin
    .from('documents')
    .insert({
      document_code: documentCode,
      title: item.title,
      type: item.type,
      department: item.department,
      revision: item.revision,
      status: 'Draft',
      owner_id: actor.id,
      owner_name: item.owner_name,
      reviewer_name: item.reviewer_name,
      approver_name: item.approver_name,
      edit_date: item.edit_date,
      expiry_date: item.edit_date,
      effective_date: item.effective_date,
      visibility: item.visibility,
      ...fileFields,
    })
    .select()
    .single()
  if (inserted.error?.code === '23505') {
    const racedDocument = await findDocumentByCode(documentCode)
    if (racedDocument) return reuseRegisteredDocument(mainDocumentId, racedDocument, item, actor, kind)
  }
  throwIfError(inserted.error)
  const document = inserted.data

  try {
    await setLink(mainDocumentId, document.id, actor, 'registered')
  } catch (error) {
    // Keep this item retryable if its follow-up link fails. R2 objects are intentionally untouched.
    const cleanup = await supabaseAdmin.from('documents').delete().eq('id', document.id)
    if (cleanup.error) {
      throw new Error(
        `${errorMessage(error)}; ล้างเอกสารที่สร้างค้างไม่สำเร็จ (document_id: ${document.id}): ${cleanup.error.message}`,
      )
    }
    throw error
  }

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: document.id, user_id: actor.id, action: 'upload' })
    .then(undefined, () => {})
  supabaseAdmin.from('audit_log').insert({
    action: 'document.upload',
    user_id: actor.id,
    target: document.document_code,
    detail: `${document.document_code} · ${document.title}`,
  }).then(undefined, () => {})
  supabaseAdmin.from('document_status_history').insert({
    document_id: document.id,
    from_status: null,
    to_status: 'Draft',
    changed_by: actor.id,
    changed_at: document.created_at,
  }).then(undefined, () => {})

  return { document }
}

async function attachFile(mainDocumentId: string, item: Extract<RegisterSetItem, { kind: 'attach' }>, actor: Actor) {
  const existing = await findDocumentAttachment(mainDocumentId, item.file.key)
  if (hasMatchingFileKey(existing, item.file.key)) {
    return { attachment: existing, reused: true }
  }

  const inserted = await supabaseAdmin
    .from('document_attachments')
    .insert({
      document_id: mainDocumentId,
      file_url: item.file.key,
      file_name: item.file.name,
      file_size: item.file.size,
      mime_type: item.file.mime,
      uploaded_by: actor.id,
      ephemeral: true,
    })
    .select()
    .single()
  if (inserted.error?.code === '23505') {
    const racedAttachment = await findDocumentAttachment(mainDocumentId, item.file.key)
    if (hasMatchingFileKey(racedAttachment, item.file.key)) {
      return { attachment: racedAttachment, reused: true }
    }
  }
  throwIfError(inserted.error)
  return { attachment: inserted.data }
}

async function reviseExisting(mainDocumentId: string, item: Extract<RegisterSetItem, { kind: 'revise-existing' }>, actor: Actor) {
  const currentResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, type, department, description, status, visibility, revision, owner_name, reviewer_name, approver_name, reviewer_id, approver_id, audience_text')
    .eq('id', item.existing_document_id)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfError(currentResult.error)
  const current = currentResult.data
  if (!current) throw new Error('ไม่พบเอกสารที่ต้องการสร้าง revision')
  if (current.status !== 'Published') throw new Error('สร้าง working revision ได้เฉพาะเอกสาร Published เท่านั้น')

  const existingLink = await findLink(mainDocumentId, current.id)
  if (existingLink?.link_kind === 'set' && existingLink.set_mode !== 'revision') {
    throw new Error(`เอกสาร ${current.document_code} เป็นสมาชิกชุดนี้ด้วยโหมด ${existingLink.set_mode ?? 'ไม่ทราบ'} อยู่แล้ว`)
  }

  let draft = null
  if (existingLink?.link_kind === 'set' && existingLink.set_mode === 'revision') {
    if (!existingLink.set_draft_id) throw new Error('ลิงก์ revision ของชุดไม่มี draft ownership')
    const ownedDraft = await supabaseAdmin
      .from('document_revision_drafts')
      .select('*')
      .eq('id', existingLink.set_draft_id)
      .eq('document_id', current.id)
      .is('cancelled_at', null)
      .neq('status', 'Published')
      .maybeSingle()
    throwIfError(ownedDraft.error)
    if (!ownedDraft.data) throw new Error(`ไม่พบ working revision ${existingLink.set_draft_id} ที่ชุดนี้เป็นเจ้าของ`)
    draft = ownedDraft.data
  } else {
    const unrelatedDraft = await supabaseAdmin
      .from('document_revision_drafts')
      .select('id')
      .eq('document_id', current.id)
      .is('cancelled_at', null)
      .neq('status', 'Published')
      .maybeSingle()
    throwIfError(unrelatedDraft.error)
    if (unrelatedDraft.data) {
      throw new Error(`เอกสาร ${current.document_code} มี working revision ${unrelatedDraft.data.id} ที่ไม่ได้เป็นของชุดนี้`)
    }
  }

  let created = false
  if (!draft) {
    const inserted = await supabaseAdmin
      .from('document_revision_drafts')
      .insert({
        document_id: current.id,
        revision: nextRevisionValue(current.revision),
        title: current.title,
        type: current.type,
        department: current.department,
        description: null,
        status: 'Draft',
        visibility: current.visibility,
        owner_name: current.owner_name,
        reviewer_name: current.reviewer_name,
        approver_name: current.approver_name,
        reviewer_id: current.reviewer_id,
        approver_id: current.approver_id,
        audience_text: current.audience_text,
        created_by: actor.id,
      })
      .select()
      .single()
    if (inserted.error?.code === '23505') {
      throw new Error(`เอกสาร ${current.document_code} มี working revision อื่นถูกสร้างพร้อมกัน จึงไม่สามารถนำมาใช้กับชุดนี้ได้`)
    }
    throwIfError(inserted.error)
    draft = inserted.data
    created = true
  }

  // Bind ownership before applying the uploaded file. A newly-created draft is removed
  // if ownership cannot be established, so no unrelated active draft is left behind.
  try {
    await setLink(mainDocumentId, current.id, actor, 'revision', draft.id)
  } catch (error) {
    if (created) {
      const cleanup = await supabaseAdmin.from('document_revision_drafts').delete().eq('id', draft.id)
      if (cleanup.error) {
        throw new Error(`${errorMessage(error)}; ล้าง working revision ที่สร้างค้างไม่สำเร็จ (${draft.id}): ${cleanup.error.message}`)
      }
    }
    throw error
  }

  if (created) {
    supabaseAdmin.from('audit_log').insert({
      action: 'document.revision_draft_create',
      user_id: actor.id,
      target: current.document_code ?? current.id,
      detail: `Rev. ${draft.revision}`,
    }).then(undefined, () => {})
  }

  const kind = fileKind(item.file)
  let fileResult: unknown
  if (kind === 'source') {
    if (hasMatchingSourceKey(draft, item.file.key)) {
      fileResult = draft
    } else {
      const updated = await supabaseAdmin
        .from('document_revision_drafts')
        .update({
          word_url: item.file.key,
          word_name: item.file.name,
          word_size: item.file.size,
        })
        .eq('id', draft.id)
        .select()
        .single()
      throwIfError(updated.error)
      draft = updated.data
      fileResult = updated.data
    }
  } else {
    const existingFile = await findDraftAttachment(draft.id, item.file.key)
    if (hasMatchingFileKey(existingFile, item.file.key)) {
      fileResult = existingFile
    } else {
      const inserted = await supabaseAdmin
        .from('document_revision_draft_attachments')
        .insert({
          draft_id: draft.id,
          document_id: current.id,
          file_url: item.file.key,
          file_name: item.file.name,
          file_size: item.file.size,
          mime_type: item.file.mime,
          uploaded_by: actor.id,
        })
        .select()
        .single()
      if (inserted.error?.code === '23505') {
        const racedFile = await findDraftAttachment(draft.id, item.file.key)
        if (hasMatchingFileKey(racedFile, item.file.key)) {
          fileResult = racedFile
        } else {
          throw inserted.error
        }
      } else {
        throwIfError(inserted.error)
        fileResult = inserted.data
      }
    }
  }

  return { document: current, draft, file: fileResult, reused: !created }
}

function setUploadKind(item: RegisterSetItem): SetUploadKind | null {
  if (item.kind === 'register' || item.kind === 'attach' || item.kind === 'revise-existing') return item.kind
  return null
}

async function isExactIdempotentRetry(mainDocumentId: string, item: RegisterSetItem, actor: Actor) {
  if (item.kind === 'register') {
    const kind = fileKind(item.file)
    const document = await findDocumentByCode(item.document_code.trim().toUpperCase())
    if (!document) return false
    const links = await supabaseAdmin
      .from('document_links')
      .select('document_id, set_mode, set_draft_id')
      .eq('linked_doc_id', document.id)
      .eq('link_kind', 'set')
    throwIfError(links.error)
    const classification = classifyRegisterRetry({
      document,
      item,
      actorId: actor.id,
      mainDocumentId,
      setLinkMainIds: (links.data ?? []).map((link) => link.document_id),
      fileKind: kind,
    })
    const currentLink = links.data?.find((link) => link.document_id === mainDocumentId)
    return classification === 'linked-retry'
      && currentLink?.set_mode === 'registered'
      && currentLink.set_draft_id === null
  }

  if (item.kind === 'attach') {
    const existing = await findDocumentAttachment(mainDocumentId, item.file.key)
    return Boolean(existing
      && existing.file_name === item.file.name
      && existing.file_size === item.file.size
      && existing.mime_type === item.file.mime
      && existing.uploaded_by === actor.id
      && existing.ephemeral === true)
  }

  if (item.kind === 'revise-existing') {
    const link = await findLink(mainDocumentId, item.existing_document_id)
    if (link?.link_kind !== 'set' || link.set_mode !== 'revision' || !link.set_draft_id) return false
    const draftResult = await supabaseAdmin
      .from('document_revision_drafts')
      .select('id, document_id, word_url, word_name, word_size, status, cancelled_at')
      .eq('id', link.set_draft_id)
      .eq('document_id', item.existing_document_id)
      .maybeSingle()
    throwIfError(draftResult.error)
    const draft = draftResult.data
    if (!draft || draft.cancelled_at || draft.status === 'Published') return false
    if (fileKind(item.file) === 'source') {
      return draft.word_url === item.file.key
        && draft.word_name === item.file.name
        && draft.word_size === item.file.size
    }
    const attachment = await findDraftAttachment(draft.id, item.file.key)
    return Boolean(attachment
      && attachment.file_name === item.file.name
      && attachment.file_size === item.file.size
      && attachment.mime_type === item.file.mime
      && attachment.uploaded_by === actor.id)
  }

  return false
}

async function requestedDocumentType(item: RegisterSetItem) {
  if (item.kind === 'register') return item.type
  if (item.kind !== 'revise-existing') return null
  const result = await supabaseAdmin
    .from('documents')
    .select('type')
    .eq('id', item.existing_document_id)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfError(result.error)
  if (!result.data) throw new Error('ไม่พบเอกสารที่ต้องการสร้าง revision')
  return result.data.type
}

type VerifiedSetUpload = { uploadId: string; leaseToken: string | null }

const REGISTER_LEASE_MS = 15 * 60 * 1000

async function releaseSetUploadLease(uploadId: string, leaseToken: string) {
  const result = await supabaseAdmin
    .from('document_set_uploads')
    .update({ lease_token: null, lease_kind: null, lease_expires_at: null, updated_at: new Date().toISOString() })
    .eq('id', uploadId)
    .eq('lease_token', leaseToken)
    .eq('lease_kind', 'register')
    .is('claimed_at', null)
  throwIfError(result.error)
}

async function verifySetUpload(mainDocumentId: string, item: RegisterSetItem, actor: Actor): Promise<VerifiedSetUpload | null> {
  const uploadKind = setUploadKind(item)
  if (!uploadKind || !('file' in item)) return null

  let ticketResult = await supabaseAdmin
    .from('document_set_uploads')
    .select('id, document_id, actor_id, upload_kind, storage_key, file_name, file_size, mime_type, expires_at, claimed_at, lease_token, lease_kind, lease_expires_at')
    .eq('id', item.file.upload_id)
    .maybeSingle()
  throwIfError(ticketResult.error)
  if (!ticketResult.data) throw new Error('ไม่พบ upload ticket ของไฟล์ชุดนี้')

  const exactRetry = await isExactIdempotentRetry(mainDocumentId, item, actor)
  const claimValidation = validateSetUploadClaim(
    ticketResult.data as SetUploadClaimContract,
    {
      uploadId: item.file.upload_id,
      mainDocumentId,
      actorId: actor.id,
      uploadKind,
      key: item.file.key,
      name: item.file.name,
      size: item.file.size,
      mime: item.file.mime,
    },
    new Date(),
    exactRetry,
  )
  if (!claimValidation.ok) throw new Error(`upload ticket ไม่ถูกต้อง: ${claimValidation.error}`)

  let leaseToken: string | null = null
  if (!ticketResult.data.claimed_at) {
    const now = new Date()
    const nowIso = now.toISOString()
    leaseToken = crypto.randomUUID()
    const leased = await supabaseAdmin
      .from('document_set_uploads')
      .update({
        lease_token: leaseToken,
        lease_kind: 'register',
        lease_expires_at: new Date(now.getTime() + REGISTER_LEASE_MS).toISOString(),
        updated_at: nowIso,
      })
      .eq('id', item.file.upload_id)
      .eq('document_id', mainDocumentId)
      .eq('actor_id', actor.id)
      .eq('upload_kind', uploadKind)
      .eq('storage_key', item.file.key)
      .eq('file_name', item.file.name)
      .eq('file_size', item.file.size)
      .eq('mime_type', item.file.mime)
      .is('claimed_at', null)
      .gt('expires_at', nowIso)
      .or(`lease_token.is.null,lease_expires_at.lt.${nowIso}`)
      .select('id, document_id, actor_id, upload_kind, storage_key, file_name, file_size, mime_type, expires_at, claimed_at, lease_token, lease_kind, lease_expires_at')
      .maybeSingle()
    throwIfError(leased.error)
    if (leased.data) {
      ticketResult = leased
    } else {
      leaseToken = null
      const reread = await supabaseAdmin
        .from('document_set_uploads')
        .select('id, document_id, actor_id, upload_kind, storage_key, file_name, file_size, mime_type, expires_at, claimed_at, lease_token, lease_kind, lease_expires_at')
        .eq('id', item.file.upload_id)
        .maybeSingle()
      throwIfError(reread.error)
      if (!reread.data) throw new Error('upload ticket ถูกลบหรือหมดอายุระหว่างดำเนินการ')
      const concurrentRetry = await isExactIdempotentRetry(mainDocumentId, item, actor)
      const rereadValidation = validateSetUploadClaim(
        reread.data as SetUploadClaimContract,
        {
          uploadId: item.file.upload_id,
          mainDocumentId,
          actorId: actor.id,
          uploadKind,
          key: item.file.key,
          name: item.file.name,
          size: item.file.size,
          mime: item.file.mime,
        },
        new Date(),
        concurrentRetry,
      )
      if (!rereadValidation.ok || !reread.data.claimed_at) {
        throw new Error('upload ticket กำลังถูกใช้งาน หมดอายุ หรือมีข้อมูลเปลี่ยนแปลง')
      }
      ticketResult = reread
    }
  }

  try {
    const type = await requestedDocumentType(item)
    const fileValidation = validateSetUploadFile({
      uploadKind,
      documentType: type,
      name: item.file.name,
      key: item.file.key,
      mime: item.file.mime,
    })
    if (!fileValidation.ok) throw new Error(`ข้อมูลไฟล์ไม่ถูกต้อง: ${fileValidation.error}`)

    let object
    try {
      object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: item.file.key }))
    } catch {
      throw new Error('ไม่พบไฟล์ที่อัปโหลดใน R2')
    }
    const objectValidation = validateSetUploadObject(item.file.size, item.file.mime, {
      contentLength: object.ContentLength,
      contentType: object.ContentType,
    })
    if (!objectValidation.ok) throw new Error(`ไฟล์ใน R2 ไม่ตรงกับ upload ticket: ${objectValidation.error}`)
    if (!ticketResult.data) throw new Error('upload ticket หายไประหว่างตรวจสอบไฟล์')
    return { uploadId: ticketResult.data.id as string, leaseToken }
  } catch (error) {
    if (leaseToken) {
      try {
        await releaseSetUploadLease(item.file.upload_id, leaseToken)
      } catch (releaseError) {
        console.error('Set upload verification lease release failed', {
          uploadId: item.file.upload_id,
          error: errorMessage(releaseError),
        })
      }
    }
    throw error
  }
}

async function markSetUploadClaimed(uploadId: string, leaseToken: string) {
  const now = new Date().toISOString()
  const result = await supabaseAdmin
    .from('document_set_uploads')
    .update({
      claimed_at: now,
      lease_token: null,
      lease_kind: null,
      lease_expires_at: null,
      updated_at: now,
    })
    .eq('id', uploadId)
    .eq('lease_token', leaseToken)
    .eq('lease_kind', 'register')
    .is('claimed_at', null)
    .select('id')
    .maybeSingle()
  throwIfError(result.error)
  if (!result.data) throw new Error('ไม่สามารถยืนยันการใช้ upload ticket เพราะ lease เปลี่ยนแปลง')
}

async function processItem(mainDocumentId: string, item: RegisterSetItem, actor: Actor) {
  switch (item.kind) {
    case 'register':
      return registerDocument(mainDocumentId, item, actor)
    case 'attach':
      return attachFile(mainDocumentId, item, actor)
    case 'link-existing':
      return linkExistingDocument(mainDocumentId, item.existing_document_id, actor)
    case 'revise-existing':
      return reviseExisting(mainDocumentId, item, actor)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง' }, { status: 422 })
  }

  const parsed = RegisterSetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const mainResult = await supabaseAdmin
    .from('documents')
    .select('id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (mainResult.error) return NextResponse.json({ error: mainResult.error.message }, { status: 500 })
  if (!mainResult.data) return NextResponse.json({ error: 'ไม่พบเอกสารหลัก' }, { status: 404 })
  if (mainResult.data.status !== 'Draft') {
    return NextResponse.json({ error: 'ลงทะเบียนชุดเอกสารได้เฉพาะเอกสารหลักสถานะ Draft' }, { status: 409 })
  }

  const succeeded: ItemSuccess[] = []
  const failed: ItemFailure[] = []
  for (const [index, item] of parsed.data.items.entries()) {
    let verifiedUpload: VerifiedSetUpload | null = null
    try {
      await requireDraftMainDocument(id)
      verifiedUpload = await verifySetUpload(id, item, actor)
      const data = await processItem(id, item, actor)
      if (verifiedUpload?.leaseToken) {
        await markSetUploadClaimed(verifiedUpload.uploadId, verifiedUpload.leaseToken)
      }
      succeeded.push({ index, kind: item.kind, item, data })
    } catch (error) {
      if (verifiedUpload?.leaseToken) {
        try {
          await releaseSetUploadLease(verifiedUpload.uploadId, verifiedUpload.leaseToken)
        } catch (releaseError) {
          console.error('Set upload register lease release failed', {
            uploadId: verifiedUpload.uploadId,
            error: errorMessage(releaseError),
          })
        }
      }
      failed.push({ index, kind: item.kind, item, error: errorMessage(error) })
    }
  }

  return NextResponse.json({ succeeded, failed })
}
