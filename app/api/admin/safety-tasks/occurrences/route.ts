import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { materializeOccurrence } from '@/lib/quality-tasks/server'
import { getSafetyCalendarOccurrences } from '@/lib/quality-tasks/safety-calendar-server'

const createSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('scheduled'), scheduleId: z.string().uuid(), periodStart: z.string().date() }),
  z.object({ mode: z.literal('adHoc'), templateId: z.string().uuid(), label: z.string().trim().min(1).max(200), ownerText: z.string().max(200).optional(), startDate: z.string().date(), endDate: z.string().date(), assignees: z.array(z.object({ userId: z.string().uuid().nullable(), manualName: z.string().max(120).nullable() })) }),
])

export async function GET(req: NextRequest) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  const from = req.nextUrl.searchParams.get('from') ?? `${new Date().getFullYear()}-01-01`
  const to = req.nextUrl.searchParams.get('to') ?? `${new Date().getFullYear()}-12-31`
  try {
    return NextResponse.json({ occurrences: await getSafetyCalendarOccurrences({ from, to, actorId: ctx.actor.id, level: ctx.level, scope: req.nextUrl.searchParams.get('scope') === 'mine' ? 'mine' : 'all' }) })
  } catch (error) { return safetyTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const payload = createSchema.parse(await req.json())
    if (payload.mode === 'adHoc' && payload.endDate < payload.startDate) throw new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น')
    const instance = await materializeOccurrence(payload, ctx.actor, ctx.level, 'safety')
    return NextResponse.json({ instance }, { status: 201 })
  } catch (error) { return safetyTaskError(error) }
}
