import { NextResponse } from 'next/server'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { archiveSafetyCertificate } from '@/lib/quality-tasks/safety-server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    await archiveSafetyCertificate((await params).id, ctx.actor)
    return NextResponse.json({ ok: true })
  } catch (error) { return safetyTaskError(error) }
}
