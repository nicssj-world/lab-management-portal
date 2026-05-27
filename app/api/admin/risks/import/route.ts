import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageRisk, getRiskActor, normalizeRiskPayload } from '@/lib/risk-server'
import { mapIorStatusToStatus, normalizeIsoDate, requiresRca } from '@/lib/risk-utils'

const rowSchema = z.object({
  external_no: z.union([z.string(), z.number()]).nullable().optional(),
  risk_no: z.union([z.string(), z.number()]).nullable().optional(),
  event_type: z.union([z.string(), z.number()]).nullable().optional(),
  event_date: z.union([z.string(), z.number()]).nullable().optional(),
  reporter_name: z.union([z.string(), z.number()]).nullable().optional(),
  reporter_position: z.union([z.string(), z.number()]).nullable().optional(),
  department_found: z.union([z.string(), z.number()]).nullable().optional(),
  department_target: z.union([z.string(), z.number()]).nullable().optional(),
  risk_type: z.union([z.string(), z.number()]).nullable().optional(),
  event_main_category: z.union([z.string(), z.number()]).nullable().optional(),
  event_sub_category: z.union([z.string(), z.number()]).nullable().optional(),
  event_category: z.union([z.string(), z.number()]).nullable().optional(),
  severity_level: z.union([z.string(), z.number()]).nullable().optional(),
  event_detail: z.union([z.string(), z.number()]).nullable().optional(),
  impact_summary: z.union([z.string(), z.number()]).nullable().optional(),
  immediate_correction: z.union([z.string(), z.number()]).nullable().optional(),
  evidence_note: z.union([z.string(), z.number()]).nullable().optional(),
  review_note: z.union([z.string(), z.number()]).nullable().optional(),
  root_cause: z.union([z.string(), z.number()]).nullable().optional(),
  effectiveness_result: z.union([z.string(), z.number()]).nullable().optional(),
  likelihood: z.union([z.string(), z.number()]).nullable().optional(),
  impact: z.union([z.string(), z.number()]).nullable().optional(),
  owner: z.union([z.string(), z.number()]).nullable().optional(),
  due_date: z.union([z.string(), z.number()]).nullable().optional(),
  follow_up_date: z.union([z.string(), z.number()]).nullable().optional(),
  ior_status: z.union([z.string(), z.number()]).nullable().optional(),
  recorded_date: z.union([z.string(), z.number()]).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const rows = z.array(rowSchema).safeParse(body.rows)
  if (!rows.success) return NextResponse.json({ error: 'รูปแบบไฟล์ไม่ตรง template หรือมีข้อมูลบางคอลัมน์อ่านไม่ได้' }, { status: 422 })

  const errors: string[] = []
  const payloads = rows.data.map((row, index) => {
    const eventDate = normalizeIsoDate(row.event_date)
    const recordedDate = normalizeIsoDate(row.recorded_date)
    const eventDetail = toText(row.event_detail)
    const externalNo = toText(row.external_no)
    const mainCategory = toText(row.event_main_category)
    const subCategory = toText(row.event_sub_category)
    const eventCategory = toText(row.event_category)
    const iorStatus = toText(row.ior_status)
    const severity = toText(row.severity_level)
    if (!eventDate || !eventDetail) {
      errors.push(`แถว ${index + 2}: ต้องมีวันที่เกิดเหตุและรายละเอียดเหตุการณ์`)
      return null
    }
    const departmentFound = stripLabSuffix(row.department_found)
    const departmentTarget = stripLabSuffix(row.department_target)
    return normalizeRiskPayload({
      ...row,
      external_no: externalNo,
      risk_no: toText(row.risk_no),
      risk_type: toText(row.risk_type),
      event_main_category: mainCategory,
      event_sub_category: subCategory,
      event_category: eventCategory ?? subCategory ?? mainCategory,
      severity_level: severity,
      event_detail: eventDetail,
      impact_summary: toText(row.impact_summary),
      immediate_correction: toText(row.immediate_correction),
      evidence_note: toText(row.evidence_note),
      review_note: toText(row.review_note),
      root_cause: toText(row.root_cause),
      effectiveness_result: toText(row.effectiveness_result),
      ior_status: iorStatus,
      event_date: eventDate,
      recorded_date: recordedDate,
      department_found: departmentFound,
      department_target: departmentTarget,
      event_type: toText(row.event_type) ?? (externalNo ? 'incident' : 'near_miss'),
      reporter_name: toText(row.reporter_name),
      reporter_position: toText(row.reporter_position),
      likelihood: row.likelihood,
      impact: row.impact,
      owner: toText(row.owner),
      due_date: normalizeIsoDate(row.due_date),
      follow_up_date: normalizeIsoDate(row.follow_up_date),
      name: eventCategory || subCategory || mainCategory || eventDetail.slice(0, 120),
      status: mapIorStatusToStatus(iorStatus),
      requires_rca: requiresRca(severity),
      created_by: actor.id,
    })
  }).filter((row): row is Record<string, unknown> => row !== null)

  if (errors.length > 0) return NextResponse.json({ inserted: 0, updated: 0, errors }, { status: 422 })
  if (payloads.length === 0) return NextResponse.json({ inserted: 0, updated: 0, errors: [] })

  const externalNos = payloads
    .map(row => String(row.external_no ?? '').trim())
    .filter(Boolean)
  const existingIds = await fetchExistingExternalIds(externalNos)
  const withExternal = payloads.filter(row => row.external_no)
  const withoutExternal = payloads.filter(row => !row.external_no)
  let imported = 0
  let skipped = 0

  if (withExternal.length > 0) {
    const seenInFile = new Set<string>()
    const uniqueExternalRows: Record<string, unknown>[] = []
    for (const row of withExternal) {
      const externalNo = String(row.external_no ?? '').trim()
      if (!externalNo || existingIds.has(externalNo) || seenInFile.has(externalNo)) {
        skipped += 1
        continue
      }
      seenInFile.add(externalNo)
      uniqueExternalRows.push(row)
    }
    const rowsToInsert = uniqueExternalRows

    if (rowsToInsert.length > 0) {
      const { error } = await supabaseAdmin
      .from('risks')
        .insert(rowsToInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      imported += rowsToInsert.length
    }
  }

  if (withoutExternal.length > 0) {
    const { error } = await supabaseAdmin.from('risks').insert(withoutExternal)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    imported += withoutExternal.length
  }

  return NextResponse.json({ inserted: imported, updated: 0, skipped, total: payloads.length, errors: [] })
}

function stripLabSuffix(value?: string | number | null) {
  const text = toText(value)
  if (!text) return null
  return text
    .replace(/\s*กลุ่มงานเทคนิคการแพทย์\s*$/u, '')
    .replace(/\s*\(Lab\)\s*$/u, '')
    .trim() || text
}

function toText(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

async function fetchExistingExternalIds(externalNos: string[]) {
  const map = new Map<string, number>()
  const unique = Array.from(new Set(externalNos))
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500)
    const { data, error } = await supabaseAdmin
      .from('risks')
      .select('id, external_no')
      .in('external_no', batch)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      if (row.external_no) map.set(String(row.external_no), Number(row.id))
    }
  }
  return map
}
