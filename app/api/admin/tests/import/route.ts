import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { canEditTests } from '@/lib/tests/permissions'
import type { ImportRow } from '@/components/tests/TestImport'

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

// keyword → color, ordered most-specific first
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

function inferTubeColor(note: string): string {
  const lower = note.toLowerCase()
  for (const [kw, color] of KEYWORD_COLOR) {
    if (lower.includes(kw)) return color
  }
  return '#000000'
}

function norm(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase()
}

function duplicateKey(categoryId: string | null, value: string | null | undefined) {
  return `${categoryId ?? ''}::${norm(value)}`
}

const TUBE_COLOR_MAP: Record<string, string> = {
  'Sodium citrate (ฟ้า)':         '#25a6eb',
  'Clotted blood (แดง)':           '#EF4444',
  'Lithium heparin (เขียว)':       '#10B981',
  'EDTA (ม่วง)':                   '#9333EA',
  'NaF (เทา)':                     '#94A3B8',
  'Urine':                         '#FACC15',
  'Stool':                         '#92400E',
  'Hemoculture aerobic (ผู้ใหญ่)': '#B91C1C',
  'Hemoculture aerobic (เด็ก)':    '#B91C1C',
  'Hemoculture fungi/TB':          '#B91C1C',
  'Blood gas syringe':             '#B91C1C',
  'Blood gas capillary tube':      '#B91C1C',
  'Cowin tube':                    '#F59E0B',
  'Random urine':                  '#FACC15',
  'Body Fluid':                    '#f221ba',
  'CSF':                           '#fe892a',
  'Sputum':                        '#001eff',
  'อื่นๆ':                         '#000000',
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role, doc_role').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null } | null
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getRolePermissions(actor.role)
    if (!canEditTests(actor, perms['รายการตรวจ'] ?? 'none'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { rows }: { rows: ImportRow[] } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'ไม่มีข้อมูล' }, { status: 422 })

    // Fetch all categories for name→id resolution
    const { data: cats } = await supabaseAdmin.from('categories').select('id, th')
    const catMap: Record<string, string> = {}
    cats?.forEach(c => { catMap[c.th.toLowerCase()] = c.id })

    const { data: existingTests, error: existingErr } = await supabaseAdmin
      .from('tests')
      .select('code, th, category_id')
    if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })

    const existingKeys = new Set<string>()
    ;(existingTests ?? []).forEach((test: { code: string | null; th: string | null; category_id: string | null }) => {
      if (test.code) existingKeys.add(duplicateKey(test.category_id, test.code))
      if (test.th) existingKeys.add(duplicateKey(test.category_id, test.th))
    })
    const importedKeys = new Set<string>()

    let imported = 0
    const errors: { row: number; error: string }[] = []

    for (const row of rows) {
      try {
        const categoryId = row.category_id ?? (row.category ? (catMap[row.category.toLowerCase()] ?? null) : null)
        const rowKeys = [
          duplicateKey(categoryId, row.code),
          duplicateKey(categoryId, row.th),
        ]
        if (rowKeys.some(key => existingKeys.has(key) || importedKeys.has(key))) {
          throw new Error('รหัสหรือชื่อรายการตรวจนี้มีอยู่แล้วในหมวดหมู่เดียวกัน')
        }
        const tubeColor = row.tube
          ? (TUBE_COLOR_MAP[row.tube] ?? inferTubeColor(row.tube))
          : null
        const contactPreset = row.category ? CATEGORY_CONTACT[row.category] : undefined
        const { error } = await supabaseAdmin.from('tests').insert({
          code:          row.code,
          th:            row.th,
          en:            row.en ?? '',
          cgd:           row.cgd ?? null,
          loinc:         row.loinc ?? null,
          category_id:   categoryId,
          price:         row.price ?? null,
          tat_minutes:   row.tat_minutes ? String(row.tat_minutes) : null,
          tube:          row.tube ?? null,
          tube_color:    tubeColor,
          specimen_note: row.specimen_note ?? null,
          volume:        row.volume ?? null,
          method:        row.method ?? null,
          ref:           row.ref ?? null,
          ref_note:      row.ref_note ?? null,
          service:        row.available_24hr ? null : (row.service ?? null),
          available_24hr: row.available_24hr ?? false,
          description:   row.description ?? null,
          contact_name:  contactPreset?.name ?? null,
          contact_phone: contactPreset?.phone ?? null,
          active:        true,
          updated_by:    actor.id,
        })
        if (error) throw new Error(error.message)
        rowKeys.forEach(key => importedKeys.add(key))
        imported++
      } catch (err) {
        errors.push({ row: row._rowNum, error: err instanceof Error ? err.message : String(err) })
      }
    }

    supabaseAdmin.from('audit_log').insert({
      action: 'test.import', user_id: actor.id,
      target: `${imported} รายการ`, detail: `นำเข้าจาก Excel`,
    }).then(undefined, () => {})

    return NextResponse.json({ imported, errors })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
