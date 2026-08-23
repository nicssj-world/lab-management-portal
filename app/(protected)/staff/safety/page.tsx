import { redirect } from 'next/navigation'
import { requireSafetyViewer, isSafetyEditor } from '@/lib/lab-map/safety-access'
import { getQualityTaskTemplates, listTaskPeople, materializeCertificateRenewals } from '@/lib/quality-tasks/server'
import { getSafetyCalendarOccurrences } from '@/lib/quality-tasks/safety-calendar-server'
import { bangkokToday } from '@/lib/quality-tasks/logic'
import { fiscalYearForDate } from '@/lib/quality-tasks/safety'
import { listSafetyCertificates, listSafetyEvidence } from '@/lib/quality-tasks/safety-server'
import { listQualityTaskHolidays } from '@/lib/quality-tasks/holidays'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SafetyTaskHub } from '@/components/safety-tasks/SafetyTaskHub'

export const dynamic = 'force-dynamic'

export default async function SafetyTasksPage() {
  const guarded = await requireSafetyViewer()
  if (guarded.response) redirect('/login')
  const actor = guarded.actor
  const isAdmin = normalizeRole(actor.role) === 'Admin'
  const editor = await isSafetyEditor(actor)
  const today = bangkokToday()
  const fiscalYear = fiscalYearForDate(today)
  const gregorianEndYear = fiscalYear - 543
  const from = `${gregorianEndYear - 1}-10-01`
  const to = `${gregorianEndYear}-09-30`
  await materializeCertificateRenewals(actor.id, today)
  const [people, templates, evidence, certificates, holidays, editorRows] = await Promise.all([
    listTaskPeople(), getQualityTaskTemplates(true, 'safety'), listSafetyEvidence(fiscalYear), listSafetyCertificates(), listQualityTaskHolidays(from, to),
    supabaseAdmin.from('lab_map_safety_editors').select('user_id').order('created_at'),
  ])
  const editorUserIds = (editorRows.data ?? []).map(row => String(row.user_id))
  const { data: committeeStaffRows } = isAdmin
    ? await supabaseAdmin.from('profiles').select('id, name, role').is('deleted_at', null).order('name')
    : editorUserIds.length
      ? await supabaseAdmin.from('profiles').select('id, name, role').in('id', editorUserIds).is('deleted_at', null).order('name')
      : { data: [] }
  const occurrences = await getSafetyCalendarOccurrences(
    { from, to, actorId: actor.id, level: editor ? 'edit' : 'view', scope: 'all' },
    { people, safetyTemplates: templates },
  )
  return <SafetyTaskHub actorId={actor.id} isEditor={editor} isAdmin={isAdmin} fiscalYear={fiscalYear} range={{ from, to }} initialOccurrences={occurrences} templates={templates} initialEvidence={evidence} initialCertificates={certificates} initialHolidays={holidays} people={people as { id: string; name: string; dept: string | null; role: string; position_title: string | null }[]}
    committeeStaff={(committeeStaffRows ?? []).map(row => ({ id: String(row.id), name: row.name as string | null, role: String(row.role) }))}
    initialEditors={(editorRows.data ?? []).map(row => ({ user_id: String(row.user_id) }))}
  />
}
