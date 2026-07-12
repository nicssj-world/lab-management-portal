import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { getQualityTaskOccurrences, materializeOccurrence } from '@/lib/quality-tasks/server'

const createSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('scheduled'), scheduleId: z.string().uuid(), periodStart: z.string().date() }),
  z.object({ mode: z.literal('adHoc'), templateId: z.string().uuid(), label: z.string().trim().min(1), dueDate: z.string().date(), assigneeIds: z.array(z.string().uuid()) }),
])

export async function GET(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  const from = req.nextUrl.searchParams.get('from'); const to = req.nextUrl.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 422 })
  try { return NextResponse.json({ occurrences: await getQualityTaskOccurrences({ from, to, actorId: ctx.actor.id, level: ctx.level, scope: req.nextUrl.searchParams.get('scope') === 'mine' ? 'mine' : 'all' }) }) } catch (error) { return qualityTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try { const instance = await materializeOccurrence(createSchema.parse(await req.json()), ctx.actor, ctx.level); return NextResponse.json({ instance }, { status: 201 }) } catch (error) { return qualityTaskError(error) }
}

