import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { archiveSurveySchema } from '@/lib/surveys/schemas'
import { getSurveyWorkspace, setSurveyArchived } from '@/lib/surveys/server'

type Context = { params: Promise<{ surveyId: string }> }

export async function GET(_request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'view')
  if (access.response) return access.response
  const { surveyId } = await params
  const workspace = await getSurveyWorkspace(surveyId)
  return workspace
    ? NextResponse.json(workspace)
    : NextResponse.json({ error: 'ไม่พบแบบสำรวจ' }, { status: 404 })
}

export async function PATCH(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const parsed = archiveSurveySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const { surveyId } = await params
  await setSurveyArchived(surveyId, parsed.data.archived)
  return NextResponse.json({ ok: true })
}
