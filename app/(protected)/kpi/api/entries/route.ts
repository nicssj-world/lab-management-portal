import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActor, canAccessResource, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { getDashboard, upsertEntries, getAssignedDeptIds, getExclusions } from '@/lib/queries/kpi'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const dept = searchParams.get('dept') ?? undefined

  if (!year || !month) return NextResponse.json({ error: 'year and month are required' }, { status: 400 })

  if (!(await canAccessResource(actor, 'KPI', 'view'))) {
    // Assigned fillers (no KPI:view perm) may only read their own assigned dept(s) —
    // used to prefill the form, not to browse other departments' data.
    const assigned = await getAssignedDeptIds(supabaseAdmin, actor.id)
    if (assigned.length === 0) return jsonForbidden()
    if (!dept) return jsonForbidden()
    const { data: deptRow } = await supabaseAdmin.from('departments').select('id').eq('code', dept).maybeSingle()
    if (!deptRow || !assigned.includes(deptRow.id)) return jsonForbidden()
  }

  const supabase = await createClient()
  const data = await getDashboard(supabase, year, month, dept)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const canEditAll = await canAccessResource(actor, 'KPI', 'edit')
  const assignedDeptIds = canEditAll ? [] : await getAssignedDeptIds(supabaseAdmin, actor.id)
  if (!canEditAll && assignedDeptIds.length === 0) return jsonForbidden()

  const { entries } = await request.json()
  if (!Array.isArray(entries)) return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })
  if (entries.length === 0) return NextResponse.json({ ok: true })

  // Scope check: assigned fillers may only write to their departments
  if (!canEditAll) {
    const allowed = new Set(assignedDeptIds)
    if (entries.some((e) => !allowed.has(e.dept_id))) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์กรอกข้อมูลของแผนกนี้' }, { status: 403 })
    }
  }

  // Reject entries for dept×kpi combos that are excluded (not filled by that dept)
  const exclusions = await getExclusions(supabaseAdmin)
  if (entries.some((e) => exclusions.has(`${e.dept_id}|${e.kpi_id}`))) {
    return NextResponse.json({ error: 'ตัวชี้วัดนี้ไม่เกี่ยวข้องกับแผนกที่เลือก' }, { status: 422 })
  }

  // Mutation must bypass RLS (kpi_entries write policy uses legacy 'staff'/'admin'
  // roles; app roles differ). Scope + exclusions already enforced above.
  await upsertEntries(supabaseAdmin, entries)
  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.entry',
    user_id: actor.id,
    target: entries[0] ? `${entries[0].fiscal_year}/${String(entries[0].month).padStart(2, '0')}` : undefined,
    detail: `บันทึก KPI ${entries.length} รายการ`,
  }).then(undefined, () => {})
  return NextResponse.json({ ok: true })
}
