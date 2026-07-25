import { redirect } from 'next/navigation'
import { canDeleteHeadContact } from '@/lib/head-contact/access'
import { getHeadContactSummary, listHeadContactSubmissions, listHeadContactUnits } from '@/lib/head-contact/admin-server'
import { requireHeadContactAccess } from '@/lib/head-contact/guard'
import { getHeadContactFormSettings } from '@/lib/head-contact/public-server'
import { HeadContactClient } from './HeadContactClient'

export const dynamic = 'force-dynamic'

export default async function HeadContactPage() {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) redirect('/staff/dashboard')
  const [list, summary, settings, units] = await Promise.all([
    listHeadContactSubmissions({ page: 1, pageSize: 50 }),
    getHeadContactSummary(),
    getHeadContactFormSettings(),
    listHeadContactUnits(),
  ])
  return (
    <HeadContactClient
      initialRows={list.rows}
      initialTotal={list.total}
      initialSummary={summary}
      initialSettings={settings}
      initialUnits={units}
      isAdmin={canDeleteHeadContact(guard.actor)}
    />
  )
}
