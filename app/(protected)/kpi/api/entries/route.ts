import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActor, canAccessResource, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { isAdminRole } from '@/lib/roles'
import { getDashboard, getDefinitions, getDepartments, getAssignedDeptIds, getExclusions } from '@/lib/queries/kpi'
import { saveKpiEntriesAtomic } from '@/lib/queries/kpi-compliance'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateKpiEntryPayload } from '@/lib/kpi/entry-validation'
import { canEditKpiPeriod, isValidKpiFiscalYear, isValidKpiMonth } from '@/lib/kpi/period-validation'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const dept = searchParams.get('dept') ?? undefined

  if (!isValidKpiFiscalYear(year) || !isValidKpiMonth(month)) {
    return NextResponse.json({ error: 'year or month is invalid' }, { status: 400 })
  }

  const canViewAll = await canAccessResource(actor, 'KPI', 'view')
  let visibleDeptCodes: Set<string> | null = null
  if (!canViewAll) {
    // Assigned fillers (no KPI:view perm) may only read their own assigned dept(s) —
    // used to prefill the form, not to browse other departments' data.
    const assigned = await getAssignedDeptIds(supabaseAdmin, actor.id)
    if (assigned.length === 0) return jsonForbidden()
    const assignedSet = new Set(assigned)
    const departments = await getDepartments(supabaseAdmin)
    const assignedCodes = departments.filter((department) => assignedSet.has(department.id)).map((department) => department.code)
    visibleDeptCodes = new Set(assignedCodes)
    if (dept && !visibleDeptCodes.has(dept)) return jsonForbidden()
  }

  const supabase = await createClient()
  const data = await getDashboard(supabase, year, month, dept)
  return NextResponse.json(visibleDeptCodes ? data.filter((row) => visibleDeptCodes!.has(row.dept_code)) : data)
}

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const isAdmin = isAdminRole(actor.role)
  const canEditAll = await canAccessResource(actor, 'KPI', 'edit')
  const assignedDeptIds = canEditAll ? [] : await getAssignedDeptIds(supabaseAdmin, actor.id)
  if (!canEditAll && assignedDeptIds.length === 0) return jsonForbidden()

  const body = await request.json()
  const [definitions, departments] = await Promise.all([
    getDefinitions(supabaseAdmin),
    getDepartments(supabaseAdmin),
  ])
  const validation = validateKpiEntryPayload(body, definitions, new Set(departments.map((department) => department.id)))
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 422 })

  const entries = validation.entries
  const clearEntries = validation.clearEntries
  if (entries.length === 0 && clearEntries.length === 0) return NextResponse.json({ ok: true })

  const allRows = [...entries, ...clearEntries]

  if (allRows.some((entry) => !canEditKpiPeriod(isAdmin, entry.fiscal_year, entry.month))) {
    return NextResponse.json({ error: 'งวดเดือนนี้ยังไม่สิ้นสุด ผู้กรอกทั่วไปยังไม่สามารถบันทึกข้อมูลได้' }, { status: 422 })
  }

  // Scope check: assigned fillers may only write to their departments
  if (!canEditAll) {
    const allowed = new Set(assignedDeptIds)
    if (allRows.some((e) => !allowed.has(e.dept_id))) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์กรอกข้อมูลของแผนกนี้' }, { status: 403 })
    }
  }

  // Reject entries for dept×kpi combos that are excluded (not filled by that dept)
  const exclusions = await getExclusions(supabaseAdmin)
  if (allRows.some((e) => exclusions.has(`${e.dept_id}|${e.kpi_id}`))) {
    return NextResponse.json({ error: 'ตัวชี้วัดนี้ไม่เกี่ยวข้องกับแผนกที่เลือก' }, { status: 422 })
  }

  // Scope + exclusions are enforced above. The database RPC performs the
  // upserts, clears, snapshot-version lookup and period reconciliation in one
  // transaction, so retries cannot split numeric values from compliance state.
  await saveKpiEntriesAtomic(supabaseAdmin, entries, clearEntries, actor.id)
  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.entry',
    user_id: actor.id,
    target: allRows[0] ? `${allRows[0].fiscal_year}/${String(allRows[0].month).padStart(2, '0')}` : undefined,
    detail: `บันทึก KPI ${entries.length} รายการ, ล้าง ${clearEntries.length} รายการ`,
  }).then(undefined, () => {})
  return NextResponse.json({ ok: true })
}
