import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { createSurveySchema } from '@/lib/surveys/schemas'
import { createSurveyWithDraft, listSurveys } from '@/lib/surveys/server'

export async function GET() {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'view')
  if (access.response) return access.response
  return NextResponse.json({ surveys: await listSurveys() })
}

export async function POST(request: Request) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const parsed = createSurveySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'ข้อมูลแบบสำรวจไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const created = await createSurveyWithDraft({ ...parsed.data, actorId: access.actor.id })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'สร้างแบบสำรวจไม่สำเร็จ' }, { status: 409 })
  }
}
