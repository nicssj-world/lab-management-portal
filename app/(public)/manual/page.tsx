import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ManualShell } from './ManualShell'
import { getPublicOutlabPartners } from '@/lib/outlab/server'
import {
  DEFAULT_MANUAL_PUBLICATION,
  type ManualPublication,
  type ManualPublicationRevision,
  type ManualSectionControl,
} from '@/lib/manual/control'

export const metadata = {
  title: 'คู่มือการใช้บริการห้องปฏิบัติการ — กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  description: 'คู่มือออนไลน์สำหรับการเก็บและนำส่งสิ่งตัวอย่าง การตรวจวิเคราะห์ และการรายงานผลทางห้องปฏิบัติการ',
}

export default async function ManualPage() {
  const supabase = await createClient()

  const [{ data: sectionsData }, { data: { user } }] = await Promise.all([
    supabase.from('manual_sections').select('id, body_html_th, body_html_en, table_data, updated_at'),
    supabase.auth.getUser(),
  ])

  const dbSections: Record<string, { th: string; en: string }> = {}
  const dbTables: Record<string, Record<string, unknown[]>> = {}
  const sectionControls: Record<string, ManualSectionControl> = {}
  for (const row of sectionsData ?? []) {
    dbSections[row.id] = { th: row.body_html_th ?? '', en: row.body_html_en ?? '' }
    sectionControls[row.id] = {
      owner_name_th: null,
      owner_name_en: null,
      revision_no: 1,
      last_change_summary: null,
      updated_at: row.updated_at ?? null,
    }
    if (row.table_data && typeof row.table_data === 'object') {
      dbTables[row.id] = row.table_data as Record<string, unknown[]>
    }
  }

  let publication: ManualPublication = DEFAULT_MANUAL_PUBLICATION
  let publicationHistory: ManualPublicationRevision[] = []
  const [{ data: publicationData }, { data: publicationHistoryData }, { data: controlData }] = await Promise.all([
    supabase
      .from('manual_publication')
      .select('id, document_code, revision, revision_date, effective_date, reviewed_at, revised_by_name, approved_by_name, updated_at')
      .eq('id', 'main')
      .maybeSingle(),
    supabase
      .from('manual_publication_revisions')
      .select('id, revision, revision_date, effective_date, change_summary, revised_by_name, approved_by_name, source_document')
      .order('sequence_no', { ascending: false }),
    supabase
      .from('manual_sections')
      .select('id, owner_name_th, owner_name_en, revision_no, last_change_summary, updated_at'),
  ])

  if (publicationData) publication = publicationData as ManualPublication
  if (publicationHistoryData) publicationHistory = publicationHistoryData as ManualPublicationRevision[]
  for (const row of controlData ?? []) {
    sectionControls[row.id] = {
      owner_name_th: row.owner_name_th ?? null,
      owner_name_en: row.owner_name_en ?? null,
      revision_no: row.revision_no ?? 1,
      last_change_summary: row.last_change_summary ?? null,
      updated_at: row.updated_at ?? null,
    }
  }

  const latestSectionUpdatedAt = Object.values(sectionControls)
    .map(section => section.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0]
  if (latestSectionUpdatedAt) {
    publication = { ...publication, reviewed_at: latestSectionUpdatedAt.slice(0, 10) }
  }

  // The relational OUTLAB registry is authoritative once its migration is present.
  // Keep the existing constants/manual table as a safe fallback during rollout.
  try {
    const partners = await getPublicOutlabPartners()
    if (partners.length > 0) {
      dbTables.outlab = {
        ...(dbTables.outlab ?? {}),
        outlabPartners: partners,
        outlabRegistryManaged: [{ enabled: true }],
      }
    }
  } catch {
    // Migration may not have reached this environment yet; preserve existing data.
  }

  let canEdit = false
  if (user) {
    const { data: actor } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()
    canEdit = ['Admin', 'Manager'].includes(actor?.role ?? '')
  }

  return (
    <ManualShell
      dbSections={dbSections}
      dbTables={dbTables}
      publication={publication}
      publicationHistory={publicationHistory}
      sectionControls={sectionControls}
      canEdit={canEdit}
    />
  )
}
