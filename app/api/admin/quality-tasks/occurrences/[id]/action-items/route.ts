import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { createActionItem, listActionItems } from '@/lib/quality-tasks/server'
import { assigneeEntrySchema } from '../../../templates/route'

const createSchema = z.object({
  assignee: assigneeEntrySchema,
  description: z.string().trim().min(1).max(500),
  dueDate: z.string().date().nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try { const items = await listActionItems((await params).id, ctx.level); return NextResponse.json({ items }) } catch (error) { return qualityTaskError(error) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const body = createSchema.parse(await req.json())
    const item = await createActionItem((await params).id, { assignee: body.assignee, description: body.description, dueDate: body.dueDate ?? null }, ctx.actor, ctx.level)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) { return qualityTaskError(error) }
}
