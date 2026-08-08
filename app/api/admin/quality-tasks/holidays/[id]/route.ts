import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminRole } from '@/lib/roles'
import { jsonForbidden } from '@/lib/auth/guards'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { deleteQualityTaskHoliday, updateQualityTaskHoliday } from '@/lib/quality-tasks/holidays'
import { qualityTaskHolidaySchema } from '../route'

type Params = { params: Promise<{ id: string }> }

async function adminContext() {
  const ctx = await qualityTaskContext('view')
  if (ctx.response) return ctx
  return isAdminRole(ctx.actor.role) ? ctx : { response: jsonForbidden() }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await adminContext(); if (ctx.response) return ctx.response
  try {
    const id = z.string().uuid().parse((await params).id)
    const input = qualityTaskHolidaySchema.parse(await req.json())
    const holiday = await updateQualityTaskHoliday(id, input, ctx.actor)
    return NextResponse.json({ holiday })
  } catch (error) { return qualityTaskError(error) }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await adminContext(); if (ctx.response) return ctx.response
  try {
    const id = z.string().uuid().parse((await params).id)
    await deleteQualityTaskHoliday(id, ctx.actor)
    return NextResponse.json({ ok: true })
  } catch (error) { return qualityTaskError(error) }
}
