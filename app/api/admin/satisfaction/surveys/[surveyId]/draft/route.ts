import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { cloneDraftSchema, draftMutationSchema } from '@/lib/surveys/schemas'
import { cloneSurveyDraft, saveSurveyDraft } from '@/lib/surveys/server'
import type { SurveyVersionDefinition } from '@/lib/surveys/types'

type Context = { params: Promise<{ surveyId: string }> }

export async function PUT(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const parsed = draftMutationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'โครงสร้างแบบสำรวจไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 400 })
  const { surveyId } = await params
  if (parsed.data.definition.surveyId !== surveyId || parsed.data.definition.status !== 'draft') {
    return NextResponse.json({ error: 'ฉบับร่างไม่ตรงกับแบบสำรวจ' }, { status: 400 })
  }
  try {
    await saveSurveyDraft(surveyId, parsed.data.definition as SurveyVersionDefinition, access.actor.id)
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }, { status: 409 })
  }
}

export async function POST(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const parsed = cloneDraftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลเวอร์ชันไม่ถูกต้อง' }, { status: 400 })
  const { surveyId } = await params
  try {
    const definition = await cloneSurveyDraft(surveyId, parsed.data.sourceVersionId, access.actor.id)
    return NextResponse.json({ definition }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'สร้างฉบับร่างไม่สำเร็จ' }, { status: 409 })
  }
}
