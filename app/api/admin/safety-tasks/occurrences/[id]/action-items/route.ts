import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { createActionItem, listActionItems } from '@/lib/quality-tasks/server'

const schema = z.object({
  assignee: z.object({ userId: z.string().uuid().nullable(), manualName: z.string().trim().max(120).nullable() }),
  description: z.string().trim().min(1).max(2000), dueDate: z.string().date().nullable(),
  sourceType: z.enum(['evacuation_drill_session', 'evacuation_drill_cycle']).nullable().optional(),
  sourceId: z.string().trim().min(1).max(200).nullable().optional(),
}).superRefine((value, context) => {
  if (Boolean(value.sourceType) !== Boolean(value.sourceId)) {
    context.addIssue({ code: 'custom', path: ['sourceId'], message: 'sourceType และ sourceId ต้องระบุเป็นคู่' })
  }
})

const sourceQuerySchema = z.object({
  sourceType: z.enum(['evacuation_drill_session', 'evacuation_drill_cycle']),
  sourceId: z.string().trim().min(1).max(200),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const sourceType = req.nextUrl.searchParams.get('sourceType')
    const sourceId = req.nextUrl.searchParams.get('sourceId')
    const source = sourceType && sourceId ? sourceQuerySchema.parse({ sourceType, sourceId }) : undefined
    return NextResponse.json({ items: await listActionItems((await params).id, ctx.level, 'safety', source) })
  } catch (error) { return safetyTaskError(error) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const item = await createActionItem((await params).id, schema.parse(await req.json()), ctx.actor, ctx.level, 'safety')
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) { return safetyTaskError(error) }
}
