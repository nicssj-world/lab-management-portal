import { NextResponse } from 'next/server'
import { requireAgreementCampaignView, requirePersonnelManage } from '@/lib/auth/guards'
import { campaignDetail, deleteAgreementCampaign } from '@/lib/personnel/annual-agreements-server'

export async function GET(_req: Request, ctx: RouteContext<'/api/admin/personnel/agreements/campaigns/[campaignId]'>) {
  const access = await requireAgreementCampaignView()
  if (access.response) return access.response
  try {
    const { campaignId } = await ctx.params
    return NextResponse.json({ data: await campaignDetail(campaignId) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ไม่พบรอบข้อตกลง' }, { status: 404 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/admin/personnel/agreements/campaigns/[campaignId]'>) {
  const access = await requirePersonnelManage()
  if (access.response) return access.response
  try {
    const { campaignId } = await ctx.params
    await deleteAgreementCampaign(campaignId, access.actor.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ลบรอบข้อตกลงไม่สำเร็จ' }, { status: 422 })
  }
}
