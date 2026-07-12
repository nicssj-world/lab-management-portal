import type { Test, TestDocument } from '@/lib/supabase/types'
import type { DocumentAccessMode } from '@/lib/tests/document-access'

export const PUBLIC_TEST_FIELDS = [
  'id',
  'code',
  'cgd',
  'loinc',
  'th',
  'en',
  'category_id',
  'tube',
  'volume',
  'method',
  'tat',
  'tat_hours',
  'service',
  'price',
  'ref',
  'stability',
  'reject',
  'priority',
  'popular',
  'active',
  'created_at',
  'updated_at',
  'lis_code',
  'short_name',
  'description',
  'department',
  'instrument',
  'methodology_note',
  'tat_minutes',
  'urgent_tat_minutes',
  'available_24hr',
  'tube_color',
  'transport_condition',
  'specimen_note',
  'contact_name',
  'contact_phone',
  'contact_email',
  'contact_note',
  'ref_note',
  'contact_staff',
  'related_doc_ids',
  'related_doc_access',
] as const

const PUBLIC_DOCUMENT_FIELDS = [
  'id',
  'test_id',
  'doc_type',
  'name',
  'created_at',
  'access_mode',
] as const

export type PublicTestDocument = Pick<TestDocument, typeof PUBLIC_DOCUMENT_FIELDS[number]> & {
  source: 'attachment'
  accessMode: DocumentAccessMode
}

export interface PublicRelatedTestDocument {
  id: string
  document_code: string
  title: string
  type: string
  source: 'library'
  accessMode: DocumentAccessMode
}

export function sanitizeTest(test: Test): Partial<Test> {
  return Object.fromEntries(
    PUBLIC_TEST_FIELDS.map((field) => [field, test[field]])
  ) as Partial<Test>
}

export function sanitizeTestDocument(doc: TestDocument): PublicTestDocument {
  return {
    ...Object.fromEntries(
    PUBLIC_DOCUMENT_FIELDS.map((field) => [field, doc[field]])
    ),
    source: 'attachment',
    accessMode: doc.access_mode,
  } as PublicTestDocument
}
