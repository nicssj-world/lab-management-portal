import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { testSchema } from '@/lib/validations/test-schema'
import { getTestDetail, updateTest, upsertReferenceRanges } from '@/lib/queries/tests'
import { referenceRangeSchema } from '@/lib/validations/test-schema'
import { getRolePermissions } from '@/lib/permissions'
import { canDeleteTests, canEditTests } from '@/lib/tests/permissions'
import { z } from 'zod'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role, doc_role').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null } | null
}

function toMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(err))
  }
  return String(err)
}

function norm(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase()
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
    const perms = await getRolePermissions(actor.role)
    if (!canEditTests(actor, perms['รายการตรวจ'] ?? 'none')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { referenceRanges: rawRanges, ...rest } = body

    const parsed = testSchema.partial().safeParse(rest)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

    const { data: current, error: currentErr } = await supabaseAdmin
      .from('tests')
      .select('code, th, category_id')
      .eq('id', Number(id))
      .single()
    if (currentErr) return NextResponse.json({ error: currentErr.message }, { status: 500 })

    const nextCode = String(parsed.data.code ?? current.code)
    const nextName = String(parsed.data.th ?? current.th)
    const nextCategoryId = String(parsed.data.category_id ?? current.category_id ?? '')
    if (nextCode.trim() || nextName.trim()) {
      const { data: existing, error: dupErr } = await supabaseAdmin
        .from('tests')
        .select('id, code, th, category_id')
        .eq('category_id', nextCategoryId)
      if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 })
      const duplicate = (existing ?? []).some((t: { id: number; code: string; th: string; category_id: string | null }) =>
        t.id !== Number(id)
        && t.category_id === nextCategoryId
        && (norm(t.code) === norm(nextCode) || norm(t.th) === norm(nextName))
      )
      if (duplicate) {
        return NextResponse.json({ error: 'รหัสหรือชื่อรายการตรวจนี้มีอยู่แล้วในหมวดหมู่เดียวกัน' }, { status: 409 })
      }
    }

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
    const perms = await getRolePermissions(actor.role)
    if (!canDeleteTests(actor, perms['รายการตรวจ'] ?? 'none')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
