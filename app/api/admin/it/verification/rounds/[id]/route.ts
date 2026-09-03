import { NextRequest, NextResponse } from 'next/server'
import { requireItVerification, jsonDatabaseError } from '@/lib/it-verification/guard'
import { getVerificationRoundDetail } from '@/lib/it-verification/queries'
import { canViewVerificationRound, getVerificationRound } from '@/lib/it-verification/service'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  const { id } = await params
  try {
    const round = await getVerificationRound(id)
    if (round && !(await canViewVerificationRound(guard.actor, round))) return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ดูรอบการทวนสอบนี้' }, { status: 403 })
    const detail = await getVerificationRoundDetail(id)
    if (!detail.round && detail.schemaReady) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (error) {
    return jsonDatabaseError(error as { message?: string })
  }
}
