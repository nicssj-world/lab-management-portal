import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ReadReportClient, type ReportPerson, type ReportRow } from './ReadReportClient'
import { REVIEW_TRACKED_TYPES } from '@/lib/documents/review'

export const dynamic = 'force-dynamic'

export default async function ReadReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase
    .from('profiles').select('role, doc_role, name').eq('id', user.id).single()

  const role = actor?.role ?? ''
  const docRole = actor?.doc_role ?? ''
  const allowed = ['Admin', 'Document Controller'].includes(role)
    || ['Document Controller', 'Quality Manager', 'Laboratory Director'].includes(docRole)
  if (!allowed) redirect('/staff/documents/dashboard')

  const [docsRes, peopleRes, logsRes] = await Promise.all([
    // Read compliance is tracked for controlled documents that staff must read (QM/QP/WI/Manual).
    supabaseAdmin.from('documents')
      .select('id, document_code, title, type, department, revision, published_at, read_audience_depts, read_audience_user_ids')
      .eq('status', 'Published')
      .in('type', REVIEW_TRACKED_TYPES)
      .is('deleted_at', null)
      .order('document_code'),
    supabaseAdmin.from('profiles')
      .select('id, name, role, document_position, dept')
      .eq('status', 'active')
      .order('name'),
    supabaseAdmin.from('document_access_logs')
      .select('document_id, user_id, created_at')
      .eq('action', 'view')
      .order('created_at', { ascending: false }),
  ])

  // QM (Quality Manual) sits above QP/WI/Manual in the ISO hierarchy, so it
  // must lead the table regardless of document_code — document_code only
  // breaks ties within the same type.
  const TYPE_PRIORITY = ['QM', 'QP', 'WI', 'Manual']
  const docs = (docsRes.data ?? []).slice().sort((a, b) => {
    const rank = TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type)
    return rank !== 0 ? rank : a.document_code.localeCompare(b.document_code)
  })
  const people: ReportPerson[] = (peopleRes.data ?? []).map((p) => ({
    id: p.id, name: p.name, role: p.role, position: p.document_position, dept: p.dept,
  }))

  // Read status resets each revision: only views logged after the current revision's
  // published_at count. Older logs are preserved in the DB as audit evidence.
  const publishedAtById = new Map<string, string | null>(docs.map((d) => [d.id, d.published_at]))
  const readersByDoc = new Map<string, Map<string, string>>()
  for (const log of logsRes.data ?? []) {
    if (!log.document_id || !log.user_id) continue
    const publishedAt = publishedAtById.get(log.document_id)
    if (publishedAt === undefined) continue
    if (publishedAt && log.created_at < publishedAt) continue
    let docReaders = readersByDoc.get(log.document_id)
    if (!docReaders) { docReaders = new Map(); readersByDoc.set(log.document_id, docReaders) }
    // Logs arrive newest-first, so the first hit per user is their latest read.
    if (!docReaders.has(log.user_id)) docReaders.set(log.user_id, log.created_at)
  }

  const rows: ReportRow[] = docs.map((d) => ({
    id: d.id,
    document_code: d.document_code,
    title: d.title,
    type: d.type,
    department: d.department,
    revision: d.revision,
    published_at: d.published_at,
    read_audience_depts: d.read_audience_depts,
    read_audience_user_ids: d.read_audience_user_ids,
    readers: Array.from(readersByDoc.get(d.id)?.entries() ?? []).map(([userId, lastRead]) => ({ userId, lastRead })),
  }))

  const canAssign = role === 'Admin' || role === 'Document Controller' || docRole === 'Document Controller'

  return (
    <ReadReportClient
      rows={rows}
      people={people}
      canAssign={canAssign}
      userRole={actor?.role ?? undefined}
      docRole={actor?.doc_role ?? undefined}
      userName={actor?.name ?? undefined}
    />
  )
}
