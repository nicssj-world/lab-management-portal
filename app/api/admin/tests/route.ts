import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { testSchema, referenceRangeSchema } from '@/lib/validations/test-schema'
import { getTests, createTest, upsertReferenceRanges } from '@/lib/queries/tests'
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

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const activeParam = sp.get('active')
    const sortDir = sp.get('sortDir')
    const result = await getTests(supabaseAdmin, {
      search:   sp.get('search') ?? undefined,
      category: sp.get('category') ?? undefined,
      tube:     sp.get('tube') ?? undefined,
      ...(activeParam !== null ? { active: activeParam === 'true' } : {}),
      page:     Number(sp.get('page') ?? 0),
      pageSize: Number(sp.get('pageSize') ?? 20),
      sortBy:   sp.get('sortBy') ?? undefined,
      sortDir:  sortDir === 'desc' ? 'desc' : 'asc',
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const canEdit = ['Admin', 'Manager'].includes(actor.role ?? '')
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { referenceRanges: rawRanges, ...rest } = body
    const parsed = testSchema.safeParse(rest)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

    const code = parsed.data.code.trim()
    const { data: existing, error: dupErr } = await supabaseAdmin
      .from('tests')
      .select('id, code')
      .ilike('code', code)

    if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 })
    const duplicate = (existing ?? []).some((t: { code: string }) => t.code.trim().toLowerCase() === code.toLowerCase())
    if (duplicate) {
      return NextResponse.json({ error: 'รหัสรายการตรวจนี้มีอยู่แล้ว' }, { status: 409 })
    }

    const test = await createTest(supabaseAdmin, { ...parsed.data, code } as Record<string, unknown>, actor.id)

    if (Array.isArray(rawRanges)) {
      const rangesParsed = z.array(referenceRangeSchema).safeParse(rawRanges)
      if (rangesParsed.success) {
        await upsertReferenceRanges(supabaseAdmin, test.id, rangesParsed.data)
      }
    }

    supabaseAdmin.from('audit_log').insert({
      action: 'test.create', user_id: actor.id,
      target: test.code, detail: test.th,
    }).then(undefined, () => {})

    return NextResponse.json(test, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
