import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { updateCampaign } from '@/lib/surveys/campaign-server'
import { updateCampaignSchema } from '@/lib/surveys/schemas'

type Context = { params: Promise<{ campaignId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const parsed = updateCampaignSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลรอบเก็บไม่ถูกต้อง' }, { status: 400 })
  const { campaignId } = await params
  try {
    await updateCampaign(campaignId, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'แก้ไขรอบไม่สำเร็จ' }, { status: 409 })
  }
}
