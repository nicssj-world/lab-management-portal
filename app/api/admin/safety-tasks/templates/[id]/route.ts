import { NextRequest, NextResponse } from 'next/server'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { deleteTemplate, saveTemplate } from '@/lib/quality-tasks/server'
import { safetyTemplateSchema } from '../route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const id = (await params).id
    await saveTemplate(safetyTemplateSchema.parse(await req.json()), ctx.actor, id, 'safety')
    return NextResponse.json({ id })
  } catch (error) { return safetyTaskError(error) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const id = (await params).id
    await deleteTemplate(id, ctx.actor, 'safety')
    return NextResponse.json({ ok: true })
  } catch (error) { return safetyTaskError(error) }
}
