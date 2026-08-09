import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { createActionItem, listActionItems } from '@/lib/quality-tasks/server'

const schema = z.object({
  assignee: z.object({ userId: z.string().uuid().nullable(), manualName: z.string().trim().max(120).nullable() }),
  description: z.string().trim().min(1).max(2000), dueDate: z.string().date().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try { return NextResponse.json({ items: await listActionItems((await params).id, ctx.level, 'safety') }) } catch (error) { return safetyTaskError(error) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const item = await createActionItem((await params).id, schema.parse(await req.json()), ctx.actor, ctx.level, 'safety')
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) { return safetyTaskError(error) }
}
