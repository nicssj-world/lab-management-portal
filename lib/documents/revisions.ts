import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Document } from '@/lib/supabase/types'

// Snapshot the current `documents` row into the `document_revisions` archive before it gets
// overwritten with a new revision. Shared by the revision-draft promote flow and the bulk
// annual-review action. Throws on insert failure.
export async function archiveCurrentRevision(current: Document, actorId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('document_revisions')
    .insert({
      document_id: current.id,
      revision_number: current.revision ?? '1',
      revision_note: current.description ?? null,
      revised_by: current.owner_name ?? null,
      approved_by: current.approver_name ?? null,
      file_url: current.file_url ?? '',
      file_name: current.file_name ?? '',
      file_size: current.file_size ?? null,
      mime_type: current.mime_type ?? null,
      source_pdf_url: current.source_pdf_url ?? null,
      source_pdf_name: current.source_pdf_name ?? null,
      source_pdf_size: current.source_pdf_size ?? null,
      source_pdf_mime_type: current.source_pdf_mime_type ?? null,
      word_url: current.word_url ?? null,
      word_name: current.word_name ?? null,
      word_size: current.word_size ?? null,
      edit_date: current.edit_date ?? null,
      effective_date: current.effective_date ?? null,
      expiry_date: current.expiry_date ?? null,
      approved_at: current.approved_at ?? null,
      published_at: current.published_at ?? null,
      approved_by_id: current.approved_by_id ?? null,
      published_by_id: current.published_by_id ?? null,
      reviewer_id: current.reviewer_id ?? null,
      approver_id: current.approver_id ?? null,
      audience_text: current.audience_text ?? null,
      cover_template_version: current.cover_template_version ?? null,
      cover_generated_at: current.cover_generated_at ?? null,
      cover_metadata: current.cover_metadata ?? null,
      imported_current_at: current.imported_current_at ?? null,
      imported_current_by: current.imported_current_by ?? null,
      imported_current_note: current.imported_current_note ?? null,
      legacy_cover_included: current.legacy_cover_included ?? false,
      uploaded_by: actorId,
    })
  if (error) throw new Error(error.message)
}
