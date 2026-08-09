import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { deleteActionItem, updateActionItem } from '@/lib/quality-tasks/server'

const patchSchema = z.object({
  assignee: z.object({ userId: z.string().uuid().nullable(), manualName: z.string().trim().max(120).nullable() }).optional(),
  description: z.string().trim().min(1).max(2000).optional(), dueDate: z.string().date().nullable().optional(), done: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { id, itemId } = await params
    return NextResponse.json({ item: await updateActionItem(id, itemId, patchSchema.parse(await req.json()), ctx.actor, ctx.level, 'safety') })
  } catch (error) { return safetyTaskError(error) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { id, itemId } = await params
    await deleteActionItem(id, itemId, ctx.actor, ctx.level, 'safety')
    return NextResponse.json({ ok: true })
  } catch (error) { return safetyTaskError(error) }
}
