import { redirect } from 'next/navigation'
import { getActor, getPermissionLevel } from '@/lib/auth/guards'
import { getQualityTaskOccurrences, getQualityTaskTemplates, listTaskPeople } from '@/lib/quality-tasks/server'
import { bangkokToday } from '@/lib/quality-tasks/logic'
import { listQualityTaskHolidays } from '@/lib/quality-tasks/holidays'
import { isAdminRole } from '@/lib/roles'
import { QualityTaskDashboard } from '@/components/quality-tasks/QualityTaskDashboard'

export const dynamic = 'force-dynamic'

export default async function QualityTasksPage({ searchParams }: { searchParams: Promise<{ create?: string; month?: string; task?: string }> }) {
  const actor = await getActor(); if (!actor) redirect('/login')
  const level = await getPermissionLevel(actor, 'งานคุณภาพ'); if (level === 'none') redirect('/staff/dashboard')
  const { create, month: requestedMonth, task } = await searchParams
  const currentMonth = bangkokToday().slice(0, 7)
  const initialMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth ?? '') ? requestedMonth! : currentMonth
  const [year, monthNumber] = initialMonth.split('-').map(Number); const month = monthNumber - 1
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)
  const [people, templates, holidays] = await Promise.all([
    listTaskPeople(),
    getQualityTaskTemplates(true),
    listQualityTaskHolidays(from, to),
  ])
  const occurrences = await getQualityTaskOccurrences(
    { from, to, actorId: actor.id, level, scope: 'all' },
    { people, templates },
  )
  return <QualityTaskDashboard actorId={actor.id} level={level} isAdmin={isAdminRole(actor.role)} initialMonth={initialMonth} initialOccurrences={occurrences} initialHolidays={holidays} templates={templates} people={people as { id: string; name: string; dept: string | null; role: string; position_title: string | null }[]} initialAdHoc={create === '1'} initialSelectedKey={task} />
}
