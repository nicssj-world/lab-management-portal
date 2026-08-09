import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { listMonthlySafetyPoints } from '@/lib/quality-tasks/monthly-safety-server'

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const scopeSchema = z.enum(['mine', 'all']).default('mine')

export async function GET(req: NextRequest) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const month = monthSchema.parse(req.nextUrl.searchParams.get('month'))
    const scope = scopeSchema.parse(req.nextUrl.searchParams.get('scope') ?? 'mine')
    return NextResponse.json(await listMonthlySafetyPoints(month, ctx.actor, ctx.isEditor, scope))
  } catch (error) {
    return safetyTaskError(error)
  }
}
