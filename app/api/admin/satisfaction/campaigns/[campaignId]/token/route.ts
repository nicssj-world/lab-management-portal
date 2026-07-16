import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { rotateCampaignToken } from '@/lib/surveys/campaign-server'
import { rotateCampaignTokenSchema } from '@/lib/surveys/schemas'

type Context = { params: Promise<{ campaignId: string }> }

export async function POST(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const parsed = rotateCampaignTokenSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'กรุณายืนยันการเปลี่ยน QR token' }, { status: 400 })
  const { campaignId } = await params
  try {
    return NextResponse.json({ publicToken: await rotateCampaignToken(campaignId) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เปลี่ยน token ไม่สำเร็จ' }, { status: 409 })
  }
}
