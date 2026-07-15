import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { getQualityTaskOccurrences, materializeOccurrence } from '@/lib/quality-tasks/server'
import { assigneeEntrySchema } from '../templates/route'

const createSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('scheduled'), scheduleId: z.string().uuid(), periodStart: z.string().date() }),
  z.object({ mode: z.literal('adHoc'), templateId: z.string().uuid(), label: z.string().trim().min(1), startDate: z.string().date(), endDate: z.string().date(), assignees: z.array(assigneeEntrySchema) }),
])

export async function GET(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  const from = req.nextUrl.searchParams.get('from'); const to = req.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 422 })
  try { return NextResponse.json({ occurrences: await getQualityTaskOccurrences({ from, to, actorId: ctx.actor.id, level: ctx.level, scope: req.nextUrl.searchParams.get('scope') === 'mine' ? 'mine' : 'all' }) }) } catch (error) { return qualityTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try { const payload = createSchema.parse(await req.json()); if (payload.mode === 'adHoc' && payload.endDate < payload.startDate) return NextResponse.json({ error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' }, { status: 422 }); const instance = await materializeOccurrence(payload, ctx.actor, ctx.level); return NextResponse.json({ instance }, { status: 201 }) } catch (error) { return qualityTaskError(error) }
}

