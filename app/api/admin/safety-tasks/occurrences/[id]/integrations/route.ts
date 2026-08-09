import { NextResponse } from 'next/server'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getSafetyTaskIntegrations } from '@/lib/quality-tasks/safety-server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try { return NextResponse.json({ integrations: await getSafetyTaskIntegrations((await params).id, ctx.level) }) } catch (error) { return safetyTaskError(error) }
}
