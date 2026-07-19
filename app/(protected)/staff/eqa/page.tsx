import { redirect } from 'next/navigation'
import { EqaDashboard } from '@/components/eqa/EqaDashboard'
import { externalQualityContext } from '@/lib/external-quality/access'
import { bangkokToday } from '@/lib/external-quality/server'
import { fiscalYearBeForDate } from '@/lib/eqa/domain'
import { getEqaOverview } from '@/lib/eqa/server'

export const dynamic = 'force-dynamic'

export default async function EqaPage({ searchParams }: { searchParams: Promise<{ fiscalYearBe?: string }> }) {
  const context = await externalQualityContext('eqa')
  if (!context.actor) redirect('/login?next=/staff/eqa')
  const requested = Number((await searchParams).fiscalYearBe)
  const fiscalYearBe = Number.isInteger(requested) && requested >= 2500 ? requested : fiscalYearBeForDate(bangkokToday())
  const overview = await getEqaOverview(fiscalYearBe)
  return <EqaDashboard overview={overview} fiscalYearBe={fiscalYearBe} canEdit={Boolean(context.canEdit)} isAdmin={Boolean(context.isAdmin)} />
}
