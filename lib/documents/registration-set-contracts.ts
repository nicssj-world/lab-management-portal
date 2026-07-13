export const REGISTRATION_SET_MODES = ['registered', 'linked', 'revision'] as const
export type RegistrationSetMode = (typeof REGISTRATION_SET_MODES)[number]
export type SetUploadKind = 'register' | 'attach' | 'revise-existing'

export interface RegistrationSetLinkContract {
  linked_doc_id: string
  set_mode: RegistrationSetMode
  set_draft_id: string | null
}

export interface RegistrationSetDraftContract {
  id: string
  document_id: string
  status: string
}

export interface RegistrationSetDocumentContract {
  id: string
  document_code: string
  status: string
}

export function selectRegistrationSetDraft<T extends RegistrationSetDraftContract>(
  link: RegistrationSetLinkContract,
  draftsById: ReadonlyMap<string, T>,
): T | null {
  if (link.set_mode !== 'revision') return null
  if (!link.set_draft_id) throw new Error(`revision set link for ${link.linked_doc_id} is missing set_draft_id`)
  const draft = draftsById.get(link.set_draft_id)
  if (!draft) throw new Error(`revision set link references missing draft ${link.set_draft_id}`)
  if (draft.document_id !== link.linked_doc_id) {
    throw new Error(`revision set link draft ${draft.id} belongs to a different document`)
  }
  return draft
}

export function findRegistrationSetTransitionBlocker<
  D extends RegistrationSetDocumentContract,
  R extends RegistrationSetDraftContract,
>(
  links: readonly RegistrationSetLinkContract[],
  documentsById: ReadonlyMap<string, D>,
  draftsById: ReadonlyMap<string, R>,
  targetStatus: string,
): { documentCode: string; reason: string } | null {
  for (const link of links) {
    if (link.set_mode === 'linked') continue
    const document = documentsById.get(link.linked_doc_id)
    if (!document) return { documentCode: link.linked_doc_id, reason: 'ไม่พบเอกสารสมาชิกในชุด' }
    if (link.set_mode === 'revision') {
      let draft: R
      try {
        draft = selectRegistrationSetDraft(link, draftsById) as R
      } catch (error) {
        return {
          documentCode: document.document_code,
          reason: error instanceof Error ? error.message : 'ข้อมูล working revision ในชุดไม่ถูกต้อง',
        }
      }
      if (draft.status !== targetStatus) {
        return {
          documentCode: document.document_code,
          reason: `working revision ยังอยู่ในสถานะ ${draft.status} (ต้องเป็น ${targetStatus})`,
        }
      }
      continue
    }
    if (document.status !== targetStatus) {
      return {
        documentCode: document.document_code,
        reason: `เอกสารสมาชิกยังอยู่ในสถานะ ${document.status} (ต้องเป็น ${targetStatus})`,
      }
    }
  }
  return null
}

export function registrationSetQueueExcludedIds(
  sets: readonly { mainDocumentId: string; memberIds: readonly string[] }[],
) {
  const ids = new Set<string>()
  for (const set of sets) {
    ids.add(set.mainDocumentId)
    for (const memberId of set.memberIds) ids.add(memberId)
  }
  return ids
}

export function registrationSetStoragePrefix(mainDocumentId: string) {
  return `documents/sets/${mainDocumentId}/`
}

export function isEphemeralSetStorageKey(mainDocumentId: string, key: string) {
  const prefix = registrationSetStoragePrefix(mainDocumentId)
  return key.startsWith(prefix) && key.length > prefix.length
}

export interface SetUploadClaimContract {
  id: string
  document_id: string
  actor_id: string
  upload_kind: SetUploadKind
  storage_key: string
  file_name: string
  file_size: number
  mime_type: string
  expires_at: string
  claimed_at: string | null
}

export interface SetUploadSubmissionContract {
  uploadId: string
  mainDocumentId: string
  actorId: string
  uploadKind: SetUploadKind
  key: string
  name: string
  size: number
  mime: string
}

export type SetUploadClaimValidation = { ok: true } | { ok: false; error: string }

export function validateSetUploadClaim(
  claim: SetUploadClaimContract,
  submission: SetUploadSubmissionContract,
  now: Date,
  allowClaimedIdempotentRetry: boolean,
): SetUploadClaimValidation {
  if (claim.id !== submission.uploadId) return { ok: false, error: 'upload id mismatch' }
  if (claim.actor_id !== submission.actorId) return { ok: false, error: 'upload actor mismatch' }
  if (claim.document_id !== submission.mainDocumentId) return { ok: false, error: 'upload main document mismatch' }
  if (claim.upload_kind !== submission.uploadKind) return { ok: false, error: 'upload kind mismatch' }
  if (claim.storage_key !== submission.key) return { ok: false, error: 'upload key mismatch' }
  if (!isEphemeralSetStorageKey(submission.mainDocumentId, submission.key)) {
    return { ok: false, error: 'upload key is outside the set namespace' }
  }
  if (claim.file_name !== submission.name) return { ok: false, error: 'upload file name mismatch' }
  if (claim.file_size !== submission.size) return { ok: false, error: 'upload file size mismatch' }
  if (claim.mime_type !== submission.mime) return { ok: false, error: 'upload MIME mismatch' }
  const expiresAt = Date.parse(claim.expires_at)
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return { ok: false, error: 'upload ticket expired' }
  if (claim.claimed_at && !allowClaimedIdempotentRetry) return { ok: false, error: 'upload ticket already claimed' }
  return { ok: true }
}

const SET_FILE_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function extension(value: string) {
  const clean = value.split(/[?#]/)[0]
  const last = clean.split('/').pop() ?? ''
  const dot = last.lastIndexOf('.')
  return dot > 0 && dot < last.length - 1 ? last.slice(dot + 1).toLowerCase() : ''
}

export function canonicalSetFileMime(name: string) {
  return SET_FILE_MIME_BY_EXTENSION[extension(name)] ?? null
}

export function validateSetUploadFile(input: {
  uploadKind: SetUploadKind
  documentType: string | null
  name: string
  key: string
  mime: string
}): SetUploadClaimValidation {
  const nameExtension = extension(input.name)
  const keyExtension = extension(input.key)
  if (nameExtension !== keyExtension) return { ok: false, error: 'upload file extension does not match storage key' }
  if (input.uploadKind === 'attach') return { ok: true }

  const canonicalMime = SET_FILE_MIME_BY_EXTENSION[nameExtension]
  if (!canonicalMime) return { ok: false, error: 'unsupported set document file extension' }
  if (canonicalMime !== input.mime.toLowerCase()) return { ok: false, error: 'upload MIME does not match file extension' }
  if ((input.documentType === 'QP' || input.documentType === 'WI') && nameExtension !== 'pdf') {
    return { ok: false, error: 'QP/WI set uploads must be PDF' }
  }
  return { ok: true }
}

export function validateSetUploadObject(
  expectedSize: number,
  expectedMime: string,
  object: { contentLength: number | null | undefined; contentType: string | null | undefined },
): SetUploadClaimValidation {
  if (object.contentLength !== expectedSize) return { ok: false, error: 'R2 object size mismatch' }
  const contentType = object.contentType?.trim().toLowerCase()
  if (contentType && contentType !== 'application/octet-stream' && contentType !== expectedMime.toLowerCase()) {
    return { ok: false, error: 'R2 object content type mismatch' }
  }
  return { ok: true }
}
