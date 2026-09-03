import { NextResponse } from 'next/server'
import { buildVerificationPdf } from '@/lib/it-verification/pdf'
import { auditVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { getVerificationRoundDetail } from '@/lib/it-verification/queries'
import { canViewVerificationRound, getVerificationRound } from '@/lib/it-verification/service'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  const { id } = await params
  try {
    const round = await getVerificationRound(id)
    if (round && !(await canViewVerificationRound(guard.actor, round))) return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ส่งออก PDF ของรอบนี้' }, { status: 403 })
    const detail = await getVerificationRoundDetail(id)
    if (!detail.round) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
    const bytes = await buildVerificationPdf(detail)
    await auditVerification('export.pdf', guard.actor.id, id, `${detail.round.code}/${detail.round.year}/Q${detail.round.quarter}`)
    const filename = `IT-Verification-${detail.round.code}-${detail.round.year}-Q${detail.round.quarter}.pdf`
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return jsonDatabaseError(error as { message?: string })
  }
}
