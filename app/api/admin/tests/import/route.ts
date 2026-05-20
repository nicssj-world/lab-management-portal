import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
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
  'อื่นๆ':                         '#000000',
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['Admin', 'Manager'].includes(actor.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { rows }: { rows: ImportRow[] } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'ไม่มีข้อมูล' }, { status: 422 })

    // Fetch all categories for name→id resolution
    const { data: cats } = await supabaseAdmin.from('categories').select('id, th')
    const catMap: Record<string, string> = {}
    cats?.forEach(c => { catMap[c.th.toLowerCase()] = c.id })

    let imported = 0
    const errors: { row: number; error: string }[] = []

    for (const row of rows) {
      try {
        const categoryId = row.category ? (catMap[row.category.toLowerCase()] ?? null) : null
        const tubeColor = row.tube ? (TUBE_COLOR_MAP[row.tube] ?? '#94A3B8') : null
        const contactPreset = row.category ? CATEGORY_CONTACT[row.category] : undefined
        const { error } = await supabaseAdmin.from('tests').upsert({
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
          volume:        row.volume ?? null,
          method:        row.method ?? null,
          ref:           row.ref ?? null,
          ref_note:      row.ref_note ?? null,
          service:       row.service ?? null,
          contact_name:  contactPreset?.name ?? null,
          contact_phone: contactPreset?.phone ?? null,
          active:        true,
          updated_by:    actor.id,
        }, { onConflict: 'code' })
        if (error) throw new Error(error.message)
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
