import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { canEditTests } from '@/lib/tests/permissions'
import { getActor } from '@/lib/auth/guards'
import type { TestExcelField } from '@/lib/tests/excel'
import type { ImportRow } from '@/lib/tests/import-types'

const CATEGORY_CONTACT: Record<string, { name: string; phone: string }> = {
  'เคมีคลินิก':                          { name: 'งานเคมีคลินิก',                          phone: '1464' },
  'ภูมิคุ้มกันวิทยาคลินิก':              { name: 'งานภูมิคุ้มกันวิทยาคลินิก',              phone: '1469' },
  'โลหิตวิทยาคลินิก':                    { name: 'งานโลหิตวิทยาคลินิก',                    phone: '1466' },
  'จุลทรรศนศาสตร์คลินิก':               { name: 'งานจุลทรรศนศาสตร์คลินิก',               phone: '1468' },
  'จุลชีววิทยาคลินิก':                   { name: 'งานจุลชีววิทยาคลินิก',                   phone: '1462, 1463' },
  'อณูชีววิทยาคลินิก':                   { name: 'งานอณูชีววิทยาคลินิก',                   phone: '1467, 1452' },
  'คลังเลือด':                           { name: 'งานคลังเลือด',                           phone: '1458' },
  'ตรวจพิเศษและปฏิบัติการตรวจต่อ':      { name: 'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',      phone: '1461' },
  'ศูนย์สุขภาพชุมชนเมืองชลบุรี':        { name: 'ศูนย์สุขภาพชุมชนเมืองชลบุรี',           phone: '1633, 1634' },
}
const CATEGORY_CONTACT_BY_NAME = new Map(
  Object.entries(CATEGORY_CONTACT).map(([name, contact]) => [name.trim().toLowerCase(), contact]),
)

const KEYWORD_COLOR: [string, string][] = [
  ['body fluid', '#f221ba'],
  ['csf',        '#fe892a'],
  ['sputum',     '#001eff'],
  ['blood gas',  '#B91C1C'],
  ['hemoculture','#B91C1C'],
  ['clotted',    '#EF4444'],
  ['citrate',    '#25a6eb'],
  ['heparin',    '#10B981'],
  ['edta',       '#9333EA'],
  ['naf',        '#94A3B8'],
  ['cowin',      '#F59E0B'],
  ['urine',      '#FACC15'],
  ['stool',      '#92400E'],
]

const TUBE_COLOR_MAP: Record<string, string> = {
  'Sodium citrate (ฟ้า)':          '#25a6eb',
  'Clotted blood (แดง)':            '#EF4444',
  'Lithium heparin (เขียว)':        '#10B981',
  'EDTA (ม่วง)':                    '#9333EA',
  'NaF (เทา)':                      '#94A3B8',
  'Urine':                          '#FACC15',
  'Stool':                          '#92400E',
  'Hemoculture aerobic (ผู้ใหญ่)': '#B91C1C',
  'Hemoculture aerobic (เด็ก)':    '#B91C1C',
  'Hemoculture fungi/TB':           '#B91C1C',
  'Blood gas syringe':              '#B91C1C',
  'Blood gas capillary tube':       '#B91C1C',
  'Cowin tube':                     '#F59E0B',
  'Random urine':                   '#FACC15',
  'Body Fluid':                     '#f221ba',
  'CSF':                            '#fe892a',
  'Sputum':                         '#001eff',
  'อื่นๆ':                          '#000000',
}

const IMPORTABLE_FIELDS = [
  'code', 'lis_code', 'cgd', 'th', 'en', 'short_name', 'category_id', 'department',
  'active', 'popular', 'price', 'tat_minutes', 'urgent_tat_minutes', 'available_24hr',
  'service', 'method', 'instrument', 'methodology_note', 'tube', 'tube_color', 'volume',
  'stability', 'transport_condition', 'reject', 'specimen_note', 'ref', 'ref_note',
  'description', 'contact_name', 'contact_phone', 'contact_email', 'contact_note',
  'contact_staff',
] as const satisfies readonly TestExcelField[]

type ImportableField = typeof IMPORTABLE_FIELDS[number]
type ExistingTest = Record<string, unknown> & {
  id: number
  code: string | null
  th: string | null
  category_id: string | null
}

async function loadExistingTests(): Promise<ExistingTest[]> {
  const pageSize = 1000
  const rows: ExistingTest[] = []
  let page = 0

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('tests')
      .select('*')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) throw error
    rows.push(...((data ?? []) as ExistingTest[]))
    page++
    if ((data ?? []).length < pageSize) break
  }

  return rows
}

function norm(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function text(value: unknown): string | null {
  if (value == null) return null
  const result = String(value).trim()
  return result || null
}

function booleanValue(value: unknown): boolean | null | undefined {
  if (value == null || String(value).trim() === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : undefined
  const valueNorm = norm(String(value))
  if (['true', '1', 'yes', 'y', 'ใช่', 'เปิด', 'เปิดใช้งาน', 'active'].includes(valueNorm)) return true
  if (['false', '0', 'no', 'n', 'ไม่', 'ไม่ใช่', 'ปิด', 'ปิดใช้งาน', 'inactive'].includes(valueNorm)) return false
  return undefined
}

function hasField(row: ImportRow, field: TestExcelField): boolean {
  if (row._fields) return row._fields.includes(field)
  return Object.prototype.hasOwnProperty.call(row, field)
}

function rowValue(row: ImportRow, field: ImportableField): unknown {
  return (row as unknown as Record<string, unknown>)[field]
}

function duplicateKey(categoryId: string | null, value: string | null | undefined) {
  return `${categoryId ?? ''}::${norm(value)}`
}

function inferTubeColor(note: string): string {
  const lower = note.toLowerCase()
  for (const [keyword, color] of KEYWORD_COLOR) {
    if (lower.includes(keyword)) return color
  }
  return '#000000'
}

function getTubeColor(tube: string | null, requestedColor: string | null): string | null {
  if (!tube) return requestedColor
  return requestedColor ?? TUBE_COLOR_MAP[tube] ?? inferTubeColor(tube)
}

function parseId(value: unknown): number | null | undefined {
  if (value == null || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function resolveCategory(
  row: ImportRow,
  current: ExistingTest | undefined,
  categoryById: Map<string, string>,
  categoryByName: Map<string, string>,
): string | null {
  const supplied = hasField(row, 'category') || hasField(row, 'category_id')
  if (!supplied) return current?.category_id ?? null

  const suppliedId = text(row.category_id)
  if (suppliedId) {
    if (!categoryById.has(suppliedId)) throw new Error('ไม่พบหมวดหมู่ ID ที่ระบุ')
    return suppliedId
  }

  const suppliedName = text(row.category)
  if (!suppliedName) return null
  const categoryId = categoryByName.get(norm(suppliedName))
  if (!categoryId) throw new Error(`ไม่พบหมวดหมู่ "${suppliedName}"`)
  return categoryId
}

function validateRow(row: ImportRow) {
  if (!text(row.code)) throw new Error('ไม่มีรหัส')
  if (!text(row.th)) throw new Error('ไม่มีชื่อรายการตรวจ')

  const id = parseId(row.id)
  if (id === undefined) throw new Error('ID ระบบไม่ถูกต้อง')

  if (hasField(row, 'price') && row.price != null) {
    const price = Number(row.price)
    if (!Number.isFinite(price) || price < 0) throw new Error('ราคาไม่ใช่ตัวเลขที่ถูกต้อง')
  }

  for (const field of ['active', 'popular', 'available_24hr', 'contact_staff'] as const) {
    if (hasField(row, field) && booleanValue(row[field]) === undefined) {
      throw new Error(`ค่า${field}ต้องเป็น ใช่/ไม่ใช่`)
    }
  }
}

function buildPayload(
  row: ImportRow,
  current: ExistingTest | undefined,
  categoryId: string | null,
  isCreate: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const include = (field: ImportableField) => isCreate || hasField(row, field)
  const currentBoolean = (field: 'active' | 'popular' | 'available_24hr' | 'contact_staff', fallback: boolean) => {
    const parsed = booleanValue(rowValue(row, field))
    if (parsed != null) return parsed
    if (!isCreate && current && typeof current[field] === 'boolean') return current[field] as boolean
    return fallback
  }

  for (const field of IMPORTABLE_FIELDS) {
    if (!include(field)) continue
    switch (field) {
      case 'code':
      case 'th':
        payload[field] = text(rowValue(row, field)) ?? ''
        break
      case 'en':
        payload[field] = text(rowValue(row, field)) ?? ''
        break
      case 'category_id':
        payload[field] = categoryId
        break
      case 'active':
        payload[field] = currentBoolean('active', true)
        break
      case 'popular':
        payload[field] = currentBoolean('popular', false)
        break
      case 'available_24hr':
        payload[field] = currentBoolean('available_24hr', false)
        break
      case 'contact_staff':
        payload[field] = currentBoolean('contact_staff', false)
        break
      case 'price': {
        const value = rowValue(row, field)
        payload[field] = value == null || value === '' ? null : Number(value)
        break
      }
      case 'service': {
        const available = currentBoolean('available_24hr', false)
        payload[field] = available ? null : text(rowValue(row, field))
        break
      }
      case 'tube_color': {
        const tube = text(rowValue(row, 'tube')) ?? (current?.tube as string | null | undefined) ?? null
        payload[field] = getTubeColor(tube, text(rowValue(row, field)))
        break
      }
      case 'contact_name':
      case 'contact_phone': {
        const value = text(rowValue(row, field))
        if (isCreate && !value) {
          const contact = row.category ? CATEGORY_CONTACT_BY_NAME.get(norm(row.category)) : undefined
          payload[field] = field === 'contact_name' ? (contact?.name ?? null) : (contact?.phone ?? null)
        } else {
          payload[field] = value
        }
        break
      }
      default:
        payload[field] = text(rowValue(row, field))
        break
    }
  }

  // A legacy/template file may provide the category name without the technical
  // category_id column. Resolve it server-side and still apply the change.
  if (!isCreate && (hasField(row, 'category') || hasField(row, 'category_id'))) {
    payload.category_id = categoryId
  }

  if (isCreate) {
    payload.active ??= true
    payload.popular ??= false
    payload.available_24hr ??= false
    payload.contact_staff ??= false
    payload.en ??= ''
    payload.category_id = categoryId
  }

  return payload
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const permissions = await getRolePermissions(actor.role)
    if (!canEditTests(actor, permissions['รายการตรวจ'] ?? 'none')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json() as { rows?: ImportRow[] }
    const rows = body.rows
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูล' }, { status: 422 })
    }

    const [{ data: categories, error: categoryError }, existingTests] = await Promise.all([
      supabaseAdmin.from('categories').select('id, th'),
      loadExistingTests(),
    ])
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 })

    const categoryById = new Map((categories ?? []).map(category => [category.id, category.th]))
    const categoryByName = new Map((categories ?? []).map(category => [norm(category.th), category.id]))
    const existingById = new Map<number, ExistingTest>(
      (existingTests ?? []).map(row => [Number(row.id), row as ExistingTest]),
    )
    const keyOwners = new Map<string, number>()
    for (const test of existingById.values()) {
      if (test.code) keyOwners.set(duplicateKey(test.category_id, test.code), test.id)
      if (test.th) keyOwners.set(duplicateKey(test.category_id, test.th), test.id)
    }

    let created = 0
    let updated = 0
    let temporaryId = -1
    const claimedIds = new Set<number>()
    const errors: { row: number; error: string }[] = []

    for (const row of rows) {
      const rowNumber = row._rowNum ?? 0
      let existing: ExistingTest | undefined
      let currentKeys: string[] = []
      let targetId: number

      try {
        validateRow(row)
        const id = parseId(row.id)
        if (id != null) {
          existing = existingById.get(id)
          if (!existing) throw new Error(`ไม่พบรายการตรวจสำหรับ ID ระบบ ${id}`)
          if (claimedIds.has(id)) throw new Error('ID ระบบซ้ำในไฟล์เดียวกัน')
          claimedIds.add(id)
          targetId = id
          currentKeys = [
            duplicateKey(existing.category_id, existing.code),
            duplicateKey(existing.category_id, existing.th),
          ]
          currentKeys.forEach(key => {
            if (keyOwners.get(key) === targetId) keyOwners.delete(key)
          })
        } else {
          targetId = temporaryId--
        }

        const categoryId = resolveCategory(row, existing, categoryById, categoryByName)
        const nextCode = text(row.code) ?? existing?.code ?? ''
        const nextName = text(row.th) ?? existing?.th ?? ''
        const nextKeys = [duplicateKey(categoryId, nextCode), duplicateKey(categoryId, nextName)]
        const conflict = nextKeys.find(key => {
          const owner = keyOwners.get(key)
          return owner != null && owner !== targetId
        })
        if (conflict) throw new Error('รหัสหรือชื่อรายการตรวจนี้มีอยู่แล้วในหมวดหมู่เดียวกัน')

        const payload = buildPayload(row, existing, categoryId, !existing)
        if (existing) {
          const { error } = await supabaseAdmin
            .from('tests')
            .update({ ...payload, updated_by: actor.id, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          if (error) throw new Error(error.message)
          updated++
        } else {
          const { error } = await supabaseAdmin
            .from('tests')
            .insert({
              ...payload,
              created_by: actor.id,
              updated_by: actor.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          if (error) throw new Error(error.message)
          created++
        }

        nextKeys.forEach(key => keyOwners.set(key, targetId))
      } catch (error) {
        if (existing) currentKeys.forEach(key => keyOwners.set(key, existing!.id))
        errors.push({ row: rowNumber, error: error instanceof Error ? error.message : String(error) })
      }
    }

    const imported = created + updated
    supabaseAdmin.from('audit_log').insert({
      action: 'test.import',
      user_id: actor.id,
      target: `${imported} รายการ`,
      detail: JSON.stringify({ source: 'Excel', created, updated, errors: errors.length }),
    }).then(undefined, () => {})

    return NextResponse.json({ imported, created, updated, errors })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
