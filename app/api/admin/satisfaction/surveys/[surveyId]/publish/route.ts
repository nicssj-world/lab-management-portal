import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { publishSurveySchema } from '@/lib/surveys/schemas'
import { publishSurveyDraft } from '@/lib/surveys/server'

type Context = { params: Promise<{ surveyId: string }> }

export async function POST(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const parsed = publishSurveySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลเวอร์ชันไม่ถูกต้อง' }, { status: 400 })
  const { surveyId } = await params
  try {
    const result = await publishSurveyDraft(surveyId, parsed.data.versionId)
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'แบบสำรวจยังไม่พร้อมเผยแพร่', issues: result.issues }, { status: 422 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เผยแพร่ไม่สำเร็จ' }, { status: 409 })
  }
}
