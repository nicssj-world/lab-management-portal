import { redirect } from 'next/navigation'
import { SatisfactionModule } from '@/components/satisfaction/SatisfactionModule'
import { getActor, getPermissionLevel } from '@/lib/auth/guards'
import { listCampaigns, listSurveys } from '@/lib/surveys/server'

export const dynamic = 'force-dynamic'

export default async function SatisfactionPage() {
  const actor = await getActor()
  if (!actor) redirect('/login')

  const level = await getPermissionLevel(actor, 'แบบสำรวจความพึงพอใจ')
  if (level === 'none') redirect('/staff/dashboard')

  const [surveys, campaigns] = await Promise.all([listSurveys(), listCampaigns()])

  return (
    <SatisfactionModule
      level={level}
      actorRole={actor.role}
      initialSurveys={surveys}
      initialCampaigns={campaigns}
    />
  )
}
