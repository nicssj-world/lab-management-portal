import { NextRequest, NextResponse } from 'next/server'
import { requireAgreementCampaignApprove } from '@/lib/auth/guards'
import { approveAgreementCampaign } from '@/lib/personnel/annual-agreements-server'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/admin/personnel/agreements/campaigns/[campaignId]/approve'>) {
  const access = await requireAgreementCampaignApprove()
  if (access.response) return access.response
  const { campaignId } = await ctx.params
  const form = await req.formData()
  const signingMethod = form.get('signingMethod')
  if (signingMethod !== 'drawn' && signingMethod !== 'saved') return NextResponse.json({ error: 'วิธีลงนามไม่ถูกต้อง' }, { status: 422 })
  try {
    await approveAgreementCampaign({
      campaignId, actorId: access.actor.id, signingMethod,
      drawnFile: form.get('signature') instanceof File ? form.get('signature') as File : null,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'รับรองรอบไม่สำเร็จ' }, { status: 422 })
  }
}
