import { timingSafeEqual } from 'node:crypto'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LAB_CODE_SCOPES = [
  { prefix: 'LAB-BM-', departmentCode: 'BIOMOLECULAR' },
  { prefix: 'LAB-SR-', departmentCode: 'OUTLAB' },
] as const

type PortalEquipmentRow = Record<string, unknown>

function hasValidToken(request: NextRequest) {
  const expected = process.env.STOCK_BM_INTEGRATION_TOKEN?.trim()
  if (!expected) return false
  const authorization = request.headers.get('authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return false
  const received = Buffer.from(match[1].trim())
  const expectedBytes = Buffer.from(expected)
  return received.length === expectedBytes.length && timingSafeEqual(received, expectedBytes)
}

function portalDetailUrl(id: string) {
  const base = process.env.PORTAL_PUBLIC_BASE_URL?.trim()
  if (!base) return null
  try {
    const url = new URL('/staff/equipment', base)
    url.searchParams.set('equipment', id)
    return url.toString()
  } catch {
    return null
  }
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function requestedLabCode(value: string | null) {
  const labCode = nullableText(value)?.toUpperCase() ?? ''
  if (!/^LAB-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(labCode)) return null
  return labCode
}

function scopeForLabCode(labCode: string) {
  return LAB_CODE_SCOPES.find((scope) => labCode.startsWith(scope.prefix)) ?? null
}

async function signedEquipmentPhoto(value: unknown) {
  const key = nullableText(value)
  if (!key) return null
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: 3600 },
  )
}

async function getPmCalSummary(equipmentIds: string[]) {
  if (!equipmentIds.length) return new Map<string, unknown[]>()

  const [{ data: plans, error: plansError }, { data: results, error: resultsError }] = await Promise.all([
    supabaseAdmin
      .from('equipment_pm_cal_plans')
      .select('id,equipment_id,fiscal_year,calendar_month,cal_type,due_date,provider,planned_cost,record_status,version,updated_at')
      .in('equipment_id', equipmentIds)
      .eq('record_status', 'active')
      .order('fiscal_year', { ascending: false })
      .order('calendar_month'),
    supabaseAdmin
      .from('equipment_calibrations')
      .select('id,plan_id,equipment_id,fiscal_year,calendar_month,cal_type,completed_date,result,certificate_no,updated_at')
      .in('equipment_id', equipmentIds)
      .order('completed_date', { ascending: false, nullsFirst: false }),
  ])
  if (plansError) throw new Error(plansError.message)
  if (resultsError) throw new Error(resultsError.message)

  const resultsByPlan = new Map<string, PortalEquipmentRow>()
  const resultsByIdentity = new Map<string, PortalEquipmentRow>()
  for (const result of (results ?? []) as PortalEquipmentRow[]) {
    if (result.plan_id && !resultsByPlan.has(String(result.plan_id))) {
      resultsByPlan.set(String(result.plan_id), result)
    }
    const identity = [
      result.equipment_id,
      result.fiscal_year,
      result.calendar_month,
      result.cal_type,
    ].join(':')
    if (!resultsByIdentity.has(identity)) resultsByIdentity.set(identity, result)
  }

  const summaries = new Map<string, unknown[]>()
  for (const plan of (plans ?? []) as PortalEquipmentRow[]) {
    const result = resultsByPlan.get(String(plan.id))
      ?? resultsByIdentity.get([
        plan.equipment_id,
        plan.fiscal_year,
        plan.calendar_month,
        plan.cal_type,
      ].join(':'))
    const item = {
      portal_plan_id: String(plan.id),
      fiscal_year: plan.fiscal_year,
      calendar_month: plan.calendar_month,
      cal_type: plan.cal_type,
      due_date: plan.due_date,
      provider: nullableText(plan.provider),
      planned_cost: plan.planned_cost ?? null,
      record_status: plan.record_status,
      version: plan.version,
      completed_date: result?.completed_date ?? null,
      result: result?.result ?? null,
      certificate_no: nullableText(result?.certificate_no),
      updated_at: result?.updated_at ?? plan.updated_at ?? null,
    }
    const equipmentId = String(plan.equipment_id)
    summaries.set(equipmentId, [...(summaries.get(equipmentId) ?? []), item])
  }
  return summaries
}

export async function GET(request: NextRequest) {
  if (!process.env.STOCK_BM_INTEGRATION_TOKEN?.trim()) {
    return NextResponse.json({ error: 'Integration is not configured' }, { status: 503 })
  }
  if (!hasValidToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const labCode = requestedLabCode(request.nextUrl.searchParams.get('lab_code'))
  if (!labCode) {
    return NextResponse.json({ error: 'A valid lab_code is required' }, { status: 400 })
  }
  const scope = scopeForLabCode(labCode)
  if (!scope) {
    return NextResponse.json({ error: 'LAB code is outside Stock-BM scope' }, { status: 404 })
  }

  // Stock-BM asks for one exact LAB code. No department name or department
  // database column is used as the lookup key.
  const { data, count, error } = await supabaseAdmin
    .from('equipment')
    .select('id,department,equipment_type,cbh_code,hospital_asset_no,serial_number,manufacturer,model,vendor,status,area_code,photo_url,updated_at,created_at', { count: 'exact' })
    .eq('cbh_code', labCode)
    .limit(2)
  if (error) {
    return NextResponse.json({ error: 'Unable to read equipment snapshot' }, { status: 500 })
  }
  if ((count ?? 0) > 1) {
    return NextResponse.json({ error: `LAB code ${labCode} is duplicated in Portal` }, { status: 409 })
  }

  const rows = (data ?? []) as PortalEquipmentRow[]
  const equipmentIds = rows.map((row) => String(row.id))
  let pmCalSummary: Map<string, unknown[]>
  try {
    pmCalSummary = await getPmCalSummary(equipmentIds)
  } catch {
    return NextResponse.json({ error: 'Unable to read PM/CAL snapshot' }, { status: 500 })
  }
  const areaResult = await supabaseAdmin
    .from('equipment_areas')
    .select('code,name_th')
    .in('code', rows.map((row) => String(row.area_code ?? '')).filter(Boolean))
  if (areaResult.error) {
    return NextResponse.json({ error: 'Unable to read equipment locations' }, { status: 500 })
  }
  const areaNames = new Map((areaResult.data ?? []).map((row) => [String(row.code), String(row.name_th)]))
  let items: PortalEquipmentRow[]
  try {
    items = await Promise.all(rows.map(async (row) => {
    const id = String(row.id)
    const areaCode = nullableText(row.area_code)
    return {
      portal_equipment_id: id,
      department_code: scope.departmentCode,
      department_name: nullableText(row.department) ?? '',
      equipment_type: String(row.equipment_type ?? ''),
      cbh_code: nullableText(row.cbh_code),
      hospital_asset_no: nullableText(row.hospital_asset_no),
      serial_number: nullableText(row.serial_number),
      manufacturer: nullableText(row.manufacturer),
      model: nullableText(row.model),
      vendor: nullableText(row.vendor),
      portal_status: nullableText(row.status) ?? 'Active',
      portal_location: areaCode ? `${areaCode} · ${areaNames.get(areaCode) ?? areaCode}` : null,
      portal_updated_at: row.updated_at ?? row.created_at ?? null,
      pm_cal_summary: pmCalSummary.get(id) ?? [],
      portal_url: portalDetailUrl(id),
      portal_photo_url: await signedEquipmentPhoto(row.photo_url),
    }
    }))
  } catch {
    return NextResponse.json({ error: 'Unable to read equipment photos' }, { status: 500 })
  }

  return NextResponse.json({
    items,
    page: 1,
    pageSize: 1,
    count: count ?? 0,
    totalPages: 1,
    scope_codes: [scope.departmentCode],
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
