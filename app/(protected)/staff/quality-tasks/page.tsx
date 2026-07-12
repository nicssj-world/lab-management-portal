import { redirect } from 'next/navigation'
import { getActor, getPermissionLevel } from '@/lib/auth/guards'
import { getQualityTaskOccurrences, getQualityTaskTemplates, listTaskPeople } from '@/lib/quality-tasks/server'
import { QualityTaskDashboard } from '@/components/quality-tasks/QualityTaskDashboard'

export const dynamic = 'force-dynamic'

export default async function QualityTasksPage() {
  const actor = await getActor(); if (!actor) redirect('/login')
  const level = await getPermissionLevel(actor, 'งานคุณภาพ'); if (level === 'none') redirect('/staff/dashboard')
  const now = new Date(); const year = now.getFullYear(); const month = now.getMonth()
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)
  const [occurrences, people, templates] = await Promise.all([
    getQualityTaskOccurrences({ from, to, actorId: actor.id, level, scope: level === 'edit' ? 'all' : 'mine' }),
    listTaskPeople(),
    getQualityTaskTemplates(true),
  ])
  return <QualityTaskDashboard actorId={actor.id} level={level} initialMonth={`${year}-${String(month + 1).padStart(2, '0')}`} initialOccurrences={occurrences} templates={templates} people={people as { id: string; name: string; dept: string | null; role: string }[]} />
}
