import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { deleteActionItem, updateActionItem } from '@/lib/quality-tasks/server'
import { assigneeEntrySchema } from '../../../../templates/route'

const patchSchema = z.object({
  assignee: assigneeEntrySchema.optional(),
  description: z.string().trim().min(1).max(500).optional(),
  dueDate: z.string().date().nullable().optional(),
  done: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { id, itemId } = await params
    const item = await updateActionItem(id, itemId, patchSchema.parse(await req.json()), ctx.actor, ctx.level)
    return NextResponse.json({ item })
  } catch (error) { return qualityTaskError(error) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { id, itemId } = await params
    await deleteActionItem(id, itemId, ctx.actor, ctx.level)
    return NextResponse.json({ ok: true })
  } catch (error) { return qualityTaskError(error) }
}
