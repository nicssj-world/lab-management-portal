import { redirect } from 'next/navigation'
import { getActor, getPermissionLevel } from '@/lib/auth/guards'
import { getQualityTaskOccurrences, getQualityTaskTemplates, listTaskPeople } from '@/lib/quality-tasks/server'
import { bangkokToday } from '@/lib/quality-tasks/logic'
import { QualityTaskDashboard } from '@/components/quality-tasks/QualityTaskDashboard'

export const dynamic = 'force-dynamic'

export default async function QualityTasksPage({ searchParams }: { searchParams: Promise<{ create?: string }> }) {
  const actor = await getActor(); if (!actor) redirect('/login')
  const level = await getPermissionLevel(actor, 'งานคุณภาพ'); if (level === 'none') redirect('/staff/dashboard')
  const [year, monthNumber] = bangkokToday().split('-').map(Number); const month = monthNumber - 1
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)
  const [people, templates] = await Promise.all([
    listTaskPeople(),
    getQualityTaskTemplates(true),
  ])
  const occurrences = await getQualityTaskOccurrences(
    { from, to, actorId: actor.id, level, scope: 'all' },
    { people, templates },
  )
  const { create } = await searchParams
  return <QualityTaskDashboard actorId={actor.id} level={level} initialMonth={`${year}-${String(month + 1).padStart(2, '0')}`} initialOccurrences={occurrences} templates={templates} people={people as { id: string; name: string; dept: string | null; role: string; position_title: string | null }[]} initialAdHoc={create === '1'} />
}
