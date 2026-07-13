import { NextRequest, NextResponse } from 'next/server'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { deleteTemplate, saveTemplate } from '@/lib/quality-tasks/server'
import { templateSchema } from '../route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('edit'); if (ctx.response) return ctx.response
  try { const id = (await params).id; await saveTemplate(templateSchema.parse(await req.json()), ctx.actor, id); return NextResponse.json({ id }) } catch (error) { return qualityTaskError(error) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('edit'); if (ctx.response) return ctx.response
  try { const id = (await params).id; await deleteTemplate(id, ctx.actor); return NextResponse.json({ ok: true }) } catch (error) { return qualityTaskError(error) }
}

