import { NextRequest, NextResponse } from 'next/server'
import { requireItVerification, jsonDatabaseError } from '@/lib/it-verification/guard'
import { getVerificationSummary } from '@/lib/it-verification/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error

  const year = Number(request.nextUrl.searchParams.get('year'))
  const quarter = Number(request.nextUrl.searchParams.get('quarter'))
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: 'year และ quarter ไม่ถูกต้อง' }, { status: 422 })
  }

  try {
    return NextResponse.json(await getVerificationSummary(year, quarter, guard.actor))
  } catch (error) {
    return jsonDatabaseError(error as { message?: string })
  }
}
