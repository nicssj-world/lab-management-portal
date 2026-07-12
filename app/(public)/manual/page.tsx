import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ManualShell } from './ManualShell'

export const metadata = {
  title: 'คู่มือการใช้บริการห้องปฏิบัติการ — กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  description: 'แนวทางปฏิบัติสำหรับการเก็บตัวอย่างส่งตรวจ และรายงานผลตัวอย่างทางห้องปฏิบัติการ MN-LAB-01',
}

export default async function ManualPage() {
  const supabase = await createClient()

  const [{ data: sectionsData }, { data: { user } }] = await Promise.all([
    supabase.from('manual_sections').select('id, body_html_th, body_html_en, table_data'),
    supabase.auth.getUser(),
  ])

  const dbSections: Record<string, { th: string; en: string }> = {}
  const dbTables: Record<string, Record<string, unknown[]>> = {}
  for (const row of sectionsData ?? []) {
    dbSections[row.id] = { th: row.body_html_th ?? '', en: row.body_html_en ?? '' }
    if (row.table_data && typeof row.table_data === 'object') {
      dbTables[row.id] = row.table_data as Record<string, unknown[]>
    }
  }

  let canEdit = false
  if (user) {
    const { data: actor } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()
    canEdit = ['Admin', 'Manager'].includes(actor?.role ?? '')
  }

  return <ManualShell dbSections={dbSections} dbTables={dbTables} canEdit={canEdit} />
}
