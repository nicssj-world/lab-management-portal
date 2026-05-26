import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { duplicateTest } from '@/lib/queries/tests'
import { getRolePermissions } from '@/lib/permissions'
import { canEditTests } from '@/lib/tests/permissions'

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getRolePermissions(actor.role)
    if (!canEditTests(actor, perms['รายการตรวจ'] ?? 'none')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const test = await duplicateTest(supabaseAdmin, Number(id), actor.id)

    supabaseAdmin.from('audit_log').insert({
      action: 'test.duplicate', user_id: actor.id,
      target: test.code, detail: `duplicated from id ${id}`,
    }).then(undefined, () => {})

    return NextResponse.json(test, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
