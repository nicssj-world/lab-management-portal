import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { monthlySafetyAssetConfigSchema } from '@/lib/validations/lab-map-safety'
import { getMonthlySafetyAssetConfig, saveMonthlySafetyAssetConfig } from '@/lib/quality-tasks/monthly-safety-config-server'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor(); if (guard.response) return guard.response
  try { return NextResponse.json(await getMonthlySafetyAssetConfig((await params).id, _req.nextUrl.searchParams.get('profile'))) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: /ไม่พบ/.test((error as Error).message) ? 404 : 500 }) }
}

export async function PUT(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor(); if (guard.response) return guard.response
  const parsed = monthlySafetyAssetConfigSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  try { return NextResponse.json(await saveMonthlySafetyAssetConfig((await params).id, parsed.data, guard.actor)) }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 422 }) }
}
