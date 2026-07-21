import { redirect } from 'next/navigation'
import { OutlabDashboard, type OutlabSection } from '@/components/outlab/OutlabDashboard'
import { externalQualityContext } from '@/lib/external-quality/access'
import { getOutlabOverview } from '@/lib/outlab/server'

export const dynamic = 'force-dynamic'

export async function renderOutlabSection(activeSection: OutlabSection) {
  const context = await externalQualityContext('outlab')
  if (!context.actor) redirect('/login?next=/staff/outlab')
  if (context.level === 'none') redirect('/staff/dashboard')
  if (activeSection === 'settings' && !context.isAdmin) redirect('/staff/outlab')
  const overview = await getOutlabOverview()
  return <OutlabDashboard overview={overview} canEdit={Boolean(context.canEdit)} isAdmin={Boolean(context.isAdmin)} activeSection={activeSection} />
}

export default async function OutlabPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string }> }) {
  const params = await searchParams
  const legacyTab = params.tab
  if (legacyTab === 'certificates') {
    const suffix = params.filter ? `?filter=${encodeURIComponent(params.filter)}` : ''
    redirect(`/staff/outlab/certificates${suffix}`)
  }
  return renderOutlabSection('dashboard')
}
