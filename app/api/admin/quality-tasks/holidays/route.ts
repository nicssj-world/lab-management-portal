import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminRole } from '@/lib/roles'
import { jsonForbidden } from '@/lib/auth/guards'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { createQualityTaskHoliday, listQualityTaskHolidays } from '@/lib/quality-tasks/holidays'

export const qualityTaskHolidaySchema = z.object({
  holidayDate: z.string().date(),
  name: z.string().trim().min(1).max(160),
  kind: z.enum(['public', 'special']),
})

function ensureAdmin(ctx: { actor: { role: string } }) {
  return isAdminRole(ctx.actor.role) ? null : jsonForbidden()
}

export async function GET(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined
  if ((from && !z.string().date().safeParse(from).success) || (to && !z.string().date().safeParse(to).success)) {
    return NextResponse.json({ error: 'ช่วงวันหยุดไม่ถูกต้อง' }, { status: 422 })
  }
  try {
    return NextResponse.json({ holidays: await listQualityTaskHolidays(from, to) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return qualityTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  const forbidden = ensureAdmin(ctx); if (forbidden) return forbidden
  try {
    const input = qualityTaskHolidaySchema.parse(await req.json())
    const holiday = await createQualityTaskHoliday(input, ctx.actor)
    return NextResponse.json({ holiday }, { status: 201 })
  } catch (error) { return qualityTaskError(error) }
}
