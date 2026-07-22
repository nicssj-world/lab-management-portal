import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canEditRisk, getRiskActor, getRiskPermission } from '@/lib/risk/access'
import { nextReviewDate, reviewDueThreshold } from '@/lib/risk/register'
import { riskRegisterSchema } from '@/lib/validations/risk-register'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, m => `\\${m}`)
}

/** คะแนน 1–5 เท่านั้น ค่าอื่นถือว่าไม่ได้กรอง — ใช้ตอนเจาะจากช่องในตารางความเสี่ยง */
function scaleValue(raw: string | null) {
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRegisterFilters(query: any, sp: URLSearchParams) {
  const status = sp.get('status')
  const level = sp.get('level')
  const residualLevel = sp.get('residualLevel')
  const department = sp.get('department')
  const q = (sp.get('q') ?? '').trim()

  query = query.is('deleted_at', null)
  if (status) query = query.eq('status', status)
  if (level) query = query.eq('level', level)
  if (residualLevel) query = query.eq('residual_level', residualLevel)
  if (department) query = query.eq('department', department)

  for (const [param, column] of [
    ['likelihood', 'likelihood'],
    ['impact', 'impact'],
    ['residualLikelihood', 'residual_likelihood'],
    ['residualImpact', 'residual_impact'],
  ] as const) {
    const value = scaleValue(sp.get(param))
    if (value !== null) query = query.eq(column, value)
  }
  // รายการที่เข้าหน้าต่างเตือน 90 วัน หรือเลยกำหนดทบทวนไปแล้ว
  if (sp.get('reviewDue') === '1') query = query.lte('next_review_date', reviewDueThreshold())
  if (q) {
    const pattern = `%${escapeLike(q)}%`
    query = query.or([
      `risk_no.ilike.${pattern}`,
      `risk_statement.ilike.${pattern}`,
      `department.ilike.${pattern}`,
      `process_step.ilike.${pattern}`,
      `hazard_category.ilike.${pattern}`,
      `owner.ilike.${pattern}`,
    ].join(','))
  }
  return query
}

export async function GET(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams

  // ตารางความเสี่ยงต้องเห็นทุกแถวที่ผ่านตัวกรอง ไม่ใช่แค่หน้าที่กำลังดู
  // ใช้ applyRegisterFilters ตัวเดียวกับรายการ ตัวเลขในตารางจึงตรงกับที่แสดงด้านล่างเสมอ
  if (sp.get('view') === 'matrix') {
    let matrixQuery = supabaseAdmin
      .from('risk_register')
      .select('id, risk_no, risk_statement, status, likelihood, impact, residual_likelihood, residual_impact')
    matrixQuery = applyRegisterFilters(matrixQuery, sp)

    // ทะเบียนจริงอยู่ระดับหลักร้อย เพดานนี้จึงกว้างพอโดยไม่ต้องดึงเป็นรอบ ๆ
    const { data, error } = await matrixQuery.limit(2000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      matrix: (data ?? [])
        .filter(r => r.status !== 'closed')
        .map(r => ({
          id: r.risk_no ?? `RR-${r.id}`,
          name: r.risk_statement,
          status: r.status,
          likelihood: r.likelihood,
          impact: r.impact,
          residualLikelihood: r.residual_likelihood,
          residualImpact: r.residual_impact,
        })),
    })
  }

  const page = parsePositiveInt(sp.get('page'), 1)
  const pageSize = Math.min(parsePositiveInt(sp.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
  const from = (page - 1) * pageSize

  let query = supabaseAdmin
    .from('risk_register')
    .select('*', { count: 'exact' })
    .order('score', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })

  query = applyRegisterFilters(query, sp)
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const countsParams = new URLSearchParams(sp)
  countsParams.delete('status')
  let countsQuery = supabaseAdmin.from('risk_register').select('status')
  countsQuery = applyRegisterFilters(countsQuery, countsParams)
  const { data: statusRows } = await countsQuery
  const statusCounts: Record<string, number> = {}
  for (const row of statusRows ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1
  }

  return NextResponse.json({ data: data ?? [], count: count ?? 0, page, pageSize, statusCounts })
}

export async function POST(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditRisk(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = riskRegisterSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('risk_register')
    .insert({
      ...parsed.data,
      // ตั้งรอบทบทวนให้ตั้งแต่สร้าง เพื่อไม่ให้มีรายการที่ไม่มีวันถูกทบทวนเลย
      next_review_date: parsed.data.next_review_date ?? nextReviewDate(parsed.data.assessed_date),
      created_by: actor.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('register.create', actor.id, data.risk_no ?? String(data.id), data.risk_statement?.slice(0, 120))
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditRisk(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : []
  if (ids.length === 0) return NextResponse.json({ error: 'ไม่ได้ระบุรายการที่ต้องการลบ' }, { status: 422 })

  const { error } = await supabaseAdmin
    .from('risk_register')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in('id', ids)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('register.delete', actor.id, ids.join(', '), `ลบ ${ids.length} รายการ`)
  return NextResponse.json({ deleted: ids.length })
}
