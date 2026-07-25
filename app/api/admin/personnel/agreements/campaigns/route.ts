import { NextRequest, NextResponse } from 'next/server'
import { requireAgreementCampaignView, requirePersonnelManage } from '@/lib/auth/guards'
import { CampaignCreateSchema } from '@/lib/personnel/annual-agreements'
import { createAgreementCampaign, listAgreementCampaigns } from '@/lib/personnel/annual-agreements-server'

export async function GET() {
  const access = await requireAgreementCampaignView()
  if (access.response) return access.response
  try { return NextResponse.json({ data: await listAgreementCampaigns() }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'โหลดรอบข้อตกลงไม่สำเร็จ' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const access = await requirePersonnelManage()
  if (access.response) return access.response
  const parsed = CampaignCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  try {
    const data = await createAgreementCampaign({ ...parsed.data, actorId: access.actor.id })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'สร้างรอบข้อตกลงไม่สำเร็จ' }, { status: 422 })
  }
}
