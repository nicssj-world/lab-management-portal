import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { testSchema } from '@/lib/validations/test-schema'
import { getTestDetail, updateTest, upsertReferenceRanges } from '@/lib/queries/tests'
import { referenceRangeSchema } from '@/lib/validations/test-schema'
import { z } from 'zod'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function toMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(err))
  }
  return String(err)
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const detail = await getTestDetail(supabaseAdmin, Number(id))
    return NextResponse.json(detail)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const canEdit = ['Admin', 'Manager'].includes(actor.role ?? '')
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { referenceRanges: rawRanges, ...rest } = body

    const parsed = testSchema.partial().safeParse(rest)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

    const test = await updateTest(supabaseAdmin, Number(id), parsed.data as Record<string, unknown>, actor.id)

    if (Array.isArray(rawRanges)) {
      const rangesSchema = z.array(referenceRangeSchema)
      const rangesParsed = rangesSchema.safeParse(rawRanges)
      if (rangesParsed.success) {
        await upsertReferenceRanges(supabaseAdmin, Number(id), rangesParsed.data)
      }
    }

    supabaseAdmin.from('audit_log').insert({
      action: 'test.update', user_id: actor.id,
      target: test.code, detail: JSON.stringify(parsed.data),
    }).then(undefined, () => {})

    return NextResponse.json(test)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const canEdit = ['Admin', 'Manager'].includes(actor.role ?? '')
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { data: test } = await supabaseAdmin.from('tests').select('code').eq('id', Number(id)).single()
    const { error } = await supabaseAdmin
      .from('tests').update({ active: false, updated_by: actor.id, updated_at: new Date().toISOString() })
      .eq('id', Number(id))
    if (error) throw error

    supabaseAdmin.from('audit_log').insert({
      action: 'test.delete', user_id: actor.id,
      target: (test as { code: string } | null)?.code ?? String(id), detail: 'soft delete',
    }).then(undefined, () => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
