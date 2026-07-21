import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManagePublicSections, getActor } from '@/lib/auth/guards'
import {
  PublicDocumentsClient,
  type PublicSection,
  type PublicSectionItem,
  type PublicDoc,
  type PublicAttachment,
  type PublicUpload,
} from './PublicDocumentsClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'เอกสารที่เกี่ยวข้อง — กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  description: 'เอกสารคุณภาพและเอกสารประกอบที่เผยแพร่สู่สาธารณะ ของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
}

type AttachmentRow = Omit<PublicAttachment, 'test_code' | 'test_name'> & {
  tests: { active: boolean; code: string; th: string } | { active: boolean; code: string; th: string }[] | null
}

export default async function RelatedDocumentsPage() {
  const [docsRes, sectionsRes, itemsRes, attachRes, uploadRes] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('id, document_code, title, type, department, revision, effective_date, file_url, file_name, mime_type, file_size')
      .is('deleted_at', null)
      .eq('visibility', 'Public')
      .eq('status', 'Published')
      .order('document_code', { ascending: true }),
    supabaseAdmin.from('public_document_sections').select('*').order('sort_order', { ascending: true }),
    supabaseAdmin.from('public_document_section_items').select('*').order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('test_documents')
      .select('id, test_id, name, doc_type, storage_path, access_mode, tests!inner(active, code, th)')
      .eq('visibility', 'Public')
      .eq('tests.active', true),
    supabaseAdmin.from('public_section_uploads').select('*').order('created_at', { ascending: true }),
  ])

  // PostgREST types the embedded relation as an array; the !inner join yields one row.
  const attachments: PublicAttachment[] = ((attachRes.data ?? []) as AttachmentRow[]).map((row) => {
    const test = Array.isArray(row.tests) ? row.tests[0] : row.tests
    return {
      id: row.id,
      test_id: row.test_id,
      name: row.name,
      doc_type: row.doc_type,
      storage_path: row.storage_path,
      access_mode: row.access_mode,
      test_code: test?.code ?? '',
      test_name: test?.th ?? '',
    }
  })

  // getActor() returns null for anonymous visitors — this page is public.
  const actor = await getActor()
  const canManage = actor ? canManagePublicSections(actor) : false

  return (
    <PublicDocumentsClient
      docs={(docsRes.data ?? []) as PublicDoc[]}
      sections={(sectionsRes.data ?? []) as PublicSection[]}
      items={(itemsRes.data ?? []) as PublicSectionItem[]}
      attachments={attachments}
      uploads={(uploadRes.data ?? []) as PublicUpload[]}
      canManage={canManage}
    />
  )
}
