import {
  resolveUncontrolledPdf,
  type CacheableDocument,
} from '@/lib/documents/uncontrolled-pdf-cache'
import {
  shouldUseUncontrolledCopy,
  type DeliveryVariant,
  type UncontrolledAudience,
} from '@/lib/documents/uncontrolled-pdf'

const CONTROLLED_DOCUMENT_TYPES = new Set(['QM', 'QP', 'WI', 'Manual'])

export class InvalidDeliveryVariantError extends Error {
  readonly code = 'INVALID_DELIVERY_VARIANT'

  constructor() {
    super('variant ต้องเป็น preview หรือ download')
  }
}

export class UnsupportedEligibleDocumentError extends Error {
  readonly code = 'UNSUPPORTED_ELIGIBLE_DOCUMENT'

  constructor() {
    super('เอกสารประเภทนี้ต้องเป็น PDF ก่อนจึงจะแสดงหรือดาวน์โหลดได้')
  }
}

export type DeliveryDocument = CacheableDocument

export function parseDeliveryVariant(value: string | null): DeliveryVariant {
  if (value === null || value === 'download') return 'download'
  if (value === 'preview') return 'preview'
  throw new InvalidDeliveryVariantError()
}

export function resolveDownloadAudience(input: {
  publicRoute: boolean
  actor: { doc_role: string | null } | null
}): UncontrolledAudience {
  if (input.publicRoute) return 'public'
  return input.actor?.doc_role === 'Viewer' ? 'viewer' : 'staff'
}

export function isEligibleControlledDocument(document: Pick<DeliveryDocument, 'type' | 'status'>) {
  return document.status === 'Published' && CONTROLLED_DOCUMENT_TYPES.has(document.type)
}

function isPdf(document: Pick<DeliveryDocument, 'file_name' | 'mime_type' | 'file_url'>) {
  return document.mime_type?.toLowerCase().includes('pdf') || /\.pdf$/i.test(document.file_name ?? document.file_url)
}

export async function resolveServedKey(input: {
  document: DeliveryDocument
  audience: UncontrolledAudience
  variant: DeliveryVariant
  now: Date
  resolveUncontrolled?: (document: CacheableDocument, variant: DeliveryVariant, now: Date) => Promise<{ key: string }>
}) {
  if (input.audience === 'staff') return { key: input.document.file_url, uncontrolled: false }

  if (isEligibleControlledDocument(input.document) && !isPdf(input.document)) {
    throw new UnsupportedEligibleDocumentError()
  }

  const requiresUncontrolledCopy = shouldUseUncontrolledCopy({
    audience: input.audience,
    variant: input.variant,
    requestedPath: input.document.file_url,
    officialPath: input.document.file_url,
    type: input.document.type,
    status: input.document.status,
    mimeType: input.document.mime_type,
    fileName: input.document.file_name,
  })
  if (!requiresUncontrolledCopy) return { key: input.document.file_url, uncontrolled: false }

  const resolve = input.resolveUncontrolled ?? resolveUncontrolledPdf
  const derivative = await resolve(input.document, input.variant, input.now)
  return { key: derivative.key, uncontrolled: true }
}
