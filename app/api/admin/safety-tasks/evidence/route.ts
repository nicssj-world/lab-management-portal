import { NextRequest, NextResponse } from 'next/server'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { listSafetyEvidence } from '@/lib/quality-tasks/safety-server'

export async function GET(req: NextRequest) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const raw = req.nextUrl.searchParams.get('fiscalYear')
    const fiscalYear = raw ? Number(raw) : undefined
    if (raw && (!Number.isInteger(fiscalYear) || fiscalYear! < 2500 || fiscalYear! > 3000)) throw new Error('ปีงบประมาณไม่ถูกต้อง')
    return NextResponse.json({ evidence: await listSafetyEvidence(fiscalYear) })
  } catch (error) { return safetyTaskError(error) }
}
