import { notFound, redirect } from 'next/navigation'
import { SurveyBuilder } from '@/components/satisfaction/SurveyBuilder'
import { getActor, getPermissionLevel } from '@/lib/auth/guards'
import { getSurveyWorkspace } from '@/lib/surveys/server'

export const dynamic = 'force-dynamic'

export default async function SatisfactionBuilderPage({
  params,
}: {
  params: Promise<{ surveyId: string }>
}) {
  const actor = await getActor()
  if (!actor) redirect('/login')
  const level = await getPermissionLevel(actor, 'แบบสำรวจความพึงพอใจ')
  if (level === 'none') redirect('/staff/dashboard')
  const { surveyId } = await params
  const workspace = await getSurveyWorkspace(surveyId)
  if (!workspace) notFound()

  return <SurveyBuilder workspace={workspace} level={level} />
}
