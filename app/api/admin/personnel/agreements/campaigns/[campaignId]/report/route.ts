import { NextResponse } from 'next/server'
import { requireAgreementCampaignView } from '@/lib/auth/guards'
import { campaignDetail } from '@/lib/personnel/annual-agreements-server'
import { generateAgreementCampaignReportPdf } from '@/lib/personnel/agreement-campaign-report-pdf'

export async function GET(req: Request, ctx: RouteContext<'/api/admin/personnel/agreements/campaigns/[campaignId]/report'>) {
  const access = await requireAgreementCampaignView()
  if (access.response) return access.response
  try {
    const { campaignId } = await ctx.params
    const data = await campaignDetail(campaignId)
    const disclosures = new Map(data.disclosures.map((disclosure: any) => [disclosure.profile_id, disclosure]))
    if (new URL(req.url).searchParams.get('format') !== 'csv') {
      const pdf = await generateAgreementCampaignReportPdf({
        title: data.campaign.title,
        fiscalYear: data.campaign.fiscal_year,
        opensOn: data.campaign.opens_on,
        dueOn: data.campaign.due_on,
        status: data.campaign.status,
        approvedAt: data.campaign.status === 'approved' ? data.campaign.locked_at : null,
        recipients: data.recipients.map((recipient: any) => ({
          name: recipient.profile?.name ?? recipient.profile_id,
          position: recipient.profile?.position_title ?? null,
          status: recipient.status,
          exemptReason: recipient.exempt_reason,
          disclosureName: disclosures.get(recipient.profile_id)?.has_activity ? disclosures.get(recipient.profile_id)?.activity_name : null,
        })),
      })
      return new NextResponse(Buffer.from(pdf), {
        headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="agreement-campaign-${campaignId}.pdf"` },
      })
    }
    const header = ['ชื่อ', 'ตำแหน่ง', 'สถานะ', 'เหตุผลยกเว้น', 'เปิดเผยกิจกรรม']
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = data.recipients.map((recipient: any) => [
      recipient.profile?.name ?? recipient.profile_id, recipient.profile?.position_title ?? '', recipient.status,
      recipient.exempt_reason ?? '', disclosures.get(recipient.profile_id)?.has_activity ? 'มี' : 'ไม่มี',
    ].map(quote).join(','))
    return new NextResponse([header.map(quote).join(','), ...rows].join('\n'), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="agreement-campaign-${campaignId}.csv"` },
    })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'สร้างรายงานไม่สำเร็จ' }, { status: 500 }) }
}
