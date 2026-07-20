import { redirect } from 'next/navigation'
import { SatisfactionModule, type SatisfactionSection } from '@/components/satisfaction/SatisfactionModule'
import { getActor } from '@/lib/auth/guards'
import { getPermissionsWithSatisfactionOverride } from '@/lib/permissions'
import { isAdminRole } from '@/lib/roles'
import { listCampaigns, listSurveys } from '@/lib/surveys/server'

export const dynamic = 'force-dynamic'

export async function renderSatisfactionSection(activeSection: SatisfactionSection) {
  const actor = await getActor()
  if (!actor) redirect('/login')

  const perms = await getPermissionsWithSatisfactionOverride(actor.role, actor.id)
  const level = perms['แบบสำรวจความพึงพอใจ'] ?? 'none'
  if (level === 'none') redirect('/staff/dashboard')

  const isAdmin = isAdminRole(actor.role)
  if (activeSection === 'settings' && !isAdmin) redirect('/staff/satisfaction')

  const [surveys, campaigns] = await Promise.all([listSurveys(), listCampaigns()])

  return (
    <SatisfactionModule
      level={level}
      isAdmin={isAdmin}
      actorRole={actor.role}
      initialSurveys={surveys}
      initialCampaigns={campaigns}
      activeSection={activeSection}
    />
  )
}

export default async function SatisfactionPage() {
  return renderSatisfactionSection('overview')
}
