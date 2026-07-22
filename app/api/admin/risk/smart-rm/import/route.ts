import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canEditRisk, getRiskActor } from '@/lib/risk/access'
import { normalizeIsoDate, normalizeSeverity, stripLabSuffix, toText } from '@/lib/risk/smart-rm'

const CHUNK = 500

const cellValue = z.union([z.string(), z.number()]).nullable().optional()

const rowSchema = z.object({
  external_no: cellValue,
  event_date: cellValue,
  recorded_date: cellValue,
  department_found: cellValue,
  department_target: cellValue,
  risk_type: cellValue,
  event_main_category: cellValue,
  event_sub_category: cellValue,
  severity_level: cellValue,
  event_detail: cellValue,
  ior_status: cellValue,
})

/**
 * นำเข้าข้อมูลจากไฟล์ Smart-RM ของโรงพยาบาล
 *
 * ใช้ upsert ตาม `external_no` เพราะข้อมูลชุดนี้เปลี่ยนได้ภายหลัง (สถานะ IOR ฝั่ง HIS เดินต่อ)
 * นำเข้าไฟล์เดิมซ้ำจึงเป็นการอัปเดตให้ตรงกับต้นทาง ไม่ใช่การสร้างข้อมูลซ้ำ
 */
export async function POST(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditRisk(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const parsed = z.array(rowSchema).safeParse(body.rows)
  if (!parsed.success) {
    return NextResponse.json({ error: 'รูปแบบไฟล์ไม่ตรง template หรือมีบางคอลัมน์อ่านไม่ได้' }, { status: 422 })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const errors: string[] = []
  const seen = new Set<string>()
  const payloads: Record<string, unknown>[] = []

  parsed.data.forEach((row, index) => {
    const line = index + 2 // +1 แถวหัวตาราง +1 เพราะ Excel นับจาก 1
    const externalNo = toText(row.external_no)
    if (!externalNo) {
      errors.push(`แถว ${line}: ไม่มีหมายเลข ซึ่งใช้เป็นตัวระบุรายการ`)
      return
    }
    if (seen.has(externalNo)) {
      errors.push(`แถว ${line}: หมายเลข ${externalNo} ซ้ำกับแถวก่อนหน้าในไฟล์เดียวกัน`)
      return
    }

    const eventDate = normalizeIsoDate(row.event_date)
    const recordedDate = normalizeIsoDate(row.recorded_date)
    if ((eventDate && eventDate > today) || (recordedDate && recordedDate > today)) {
      errors.push(`แถว ${line}: วันที่เกินวันปัจจุบัน (ตรวจรูปแบบ พ.ศ./ค.ศ. ให้ถูกต้อง)`)
      return
    }

    seen.add(externalNo)
    payloads.push({
      external_no: externalNo,
      event_date: eventDate,
      recorded_date: recordedDate,
      department_found: stripLabSuffix(row.department_found),
      department_target: stripLabSuffix(row.department_target),
      risk_type: toText(row.risk_type),
      event_main_category: toText(row.event_main_category),
      event_sub_category: toText(row.event_sub_category),
      severity_level: normalizeSeverity(row.severity_level),
      event_detail: toText(row.event_detail),
      ior_status: toText(row.ior_status),
      imported_at: new Date().toISOString(),
      imported_by: actor.id,
    })
  })

  if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 })
  if (payloads.length === 0) return NextResponse.json({ inserted: 0, updated: 0, total: 0, errors: [] })

  // นับว่าแถวไหนมีอยู่แล้ว เพื่อบอกผู้ใช้ได้ว่า "เพิ่มใหม่กี่รายการ อัปเดตกี่รายการ"
  const existing = new Set<string>()
  const allNos = payloads.map(p => String(p.external_no))
  for (let i = 0; i < allNos.length; i += CHUNK) {
    const { data, error } = await supabaseAdmin
      .from('smart_rm_events')
      .select('external_no')
      .in('external_no', allNos.slice(i, i + CHUNK))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const row of data ?? []) existing.add(String(row.external_no))
  }

  for (let i = 0; i < payloads.length; i += CHUNK) {
    const { error } = await supabaseAdmin
      .from('smart_rm_events')
      .upsert(payloads.slice(i, i + CHUNK), { onConflict: 'external_no' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const updated = allNos.filter(no => existing.has(no)).length
  const inserted = payloads.length - updated

  auditRisk('smart_rm.import', actor.id, `${payloads.length} rows`,
    `นำเข้า Smart-RM: เพิ่มใหม่ ${inserted} · อัปเดต ${updated}`)

  return NextResponse.json({ inserted, updated, total: payloads.length, errors: [] })
}
