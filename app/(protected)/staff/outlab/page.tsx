import { redirect } from 'next/navigation'
import { OutlabDashboard } from '@/components/outlab/OutlabDashboard'
import { externalQualityContext } from '@/lib/external-quality/access'
import { getOutlabOverview } from '@/lib/outlab/server'

export const dynamic = 'force-dynamic'

export default async function OutlabPage() {
  const context = await externalQualityContext('outlab')
  if (!context.actor) redirect('/login?next=/staff/outlab')
  const overview = await getOutlabOverview()
  return <OutlabDashboard overview={overview} canEdit={Boolean(context.canEdit)} isAdmin={Boolean(context.isAdmin)} />
}
