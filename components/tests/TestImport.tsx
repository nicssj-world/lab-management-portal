'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { Icon } from '@/components/ui/Icon'
import type { Category } from '@/lib/supabase/types'
import { TEST_EXCEL_COLUMNS, type TestExcelField } from '@/lib/tests/excel'
import type { ImportRow } from '@/lib/tests/import-types'

export type { ImportRow } from '@/lib/tests/import-types'


// Normalize header for matching
function norm(s: string) {
  return s.toLowerCase().replace(/[\s\-_()/]/g, '')
}

const HEADER_MAP: Record<string, TestExcelField> = Object.fromEntries(
  TEST_EXCEL_COLUMNS.map(column => [norm(column.header), column.key]),
) as Record<string, TestExcelField>

Object.assign(HEADER_MAP, {
  'id': 'id', 'idsystem': 'id', 'รหัสรายการตรวจid': 'id', 'รายการตรวจid': 'id',
  'รหัส': 'code', 'รหัสการทดสอบ': 'code', 'รหัสephis': 'code', 'ephis': 'code', 'code': 'code', 'testcode': 'code',
  'รหัสlis': 'lis_code', 'lis': 'lis_code', 'liscode': 'lis_code',
  'รหัสกรมบัญชีกลาง': 'cgd', 'cgd': 'cgd', 'รหัสcgd': 'cgd',
  'ชื่อรายการตรวจ': 'th', 'ชื่อไทย': 'th', 'ชื่อภาษาไทย': 'th', 'th': 'th', 'ชื่อ': 'th',
  'ชื่ออังกฤษ': 'en', 'ชื่อเต็ม': 'en', 'en': 'en', 'english': 'en', 'ชื่อเต็มชื่ออื่นๆ': 'en',
  'ชื่อย่อ': 'short_name', 'shortname': 'short_name',
  'loinc': 'loinc',
  'หมวดหมู่': 'category', 'category': 'category',
  'หมวดหมู่id': 'category_id', 'categoryid': 'category_id',
  'หน่วยงาน': 'department', 'department': 'department',
  'เปิดใช้งาน': 'active', 'active': 'active',
  'รายการยอดนิยม': 'popular', 'ยอดนิยม': 'popular', 'popular': 'popular',
  'ราคา': 'price', 'price': 'price',
  'tat': 'tat_minutes', 'tatนาที': 'tat_minutes', 'tatminutes': 'tat_minutes', 'tat_minutes': 'tat_minutes',
  'tatเร่งด่วน': 'urgent_tat_minutes', 'urgenttat': 'urgent_tat_minutes', 'urgenttatminutes': 'urgent_tat_minutes', 'urgent_tat_minutes': 'urgent_tat_minutes',
  'ตลอด24ชั่วโมง': 'available_24hr', 'available24hr': 'available_24hr', 'available_24hr': 'available_24hr',
  'specimen': 'tube', 'tube': 'tube', 'ชนิดspecimen': 'tube', 'ชนิดsspecimen': 'tube',
  'ปริมาตร': 'volume', 'volume': 'volume',
  'วิธีการ': 'method', 'method': 'method', 'หลักการทดสอบ': 'method',
  'เครื่องมือ': 'instrument', 'instrument': 'instrument',
  'ข้อบ่งชี้หมายเหตุวิธีการ': 'methodology_note', 'methodologynote': 'methodology_note',
  'สีหลอด': 'tube_color', 'tubecolor': 'tube_color',
  'การเก็บรักษาหลังตรวจ': 'stability', 'stability': 'stability',
  'เงื่อนไขการนำส่ง': 'transport_condition', 'transportcondition': 'transport_condition',
  'เงื่อนไขปฏิเสธ': 'reject', 'reject': 'reject',
  'ค่าอ้างอิง': 'ref', 'ref': 'ref', 'referencRange': 'ref', 'referencerange': 'ref',
  'หมายเหตุ': 'ref_note', 'refnote': 'ref_note', 'note': 'ref_note',
  'วันเวลาที่ตรวจ': 'service', 'service': 'service', 'วันเวลาที่ตรวจวิเคราะห์': 'service',
  'รายละเอียดอื่นๆ': 'specimen_note', 'รายละเอียด': 'specimen_note', 'หมายเหตุเพิ่มเติม': 'specimen_note',
  'รายละเอียดspecimen': 'specimen_note', 'specimennote': 'specimen_note',
  'คำอธิบาย': 'description', 'description': 'description',
  'ชื่อหน่วยงานติดต่อ': 'contact_name', 'contactname': 'contact_name',
  'โทรศัพท์ติดต่อ': 'contact_phone', 'contactphone': 'contact_phone',
  'อีเมลติดต่อ': 'contact_email', 'contactemail': 'contact_email',
  'หมายเหตุติดต่อ': 'contact_note', 'contactnote': 'contact_note',
  'ติดต่อเจ้าหน้าที่': 'contact_staff', 'contactstaff': 'contact_staff',
})

function optionalText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function parseBoolean(value: unknown): boolean | null | undefined {
  if (value == null || String(value).trim() === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : undefined
  const text = norm(String(value))
  if (['true', '1', 'yes', 'y', 'ใช่', 'เปิด', 'เปิดใช้งาน', 'active'].includes(text)) return true
  if (['false', '0', 'no', 'n', 'ไม่', 'ไม่ใช่', 'ปิด', 'ปิดใช้งาน', 'inactive'].includes(text)) return false
  return undefined
}

function parseId(value: unknown): number | null | undefined {
  if (value == null || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function parseExcel(file: File): Promise<Record<string, unknown>[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // Dynamic import to avoid SSR issues
        import('xlsx').then(XLSX => {
          const wb = XLSX.read(e.target?.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          if (!ws) throw new Error('ไม่พบ worksheet')
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
          resolve(data as Record<string, unknown>[][])
        }).catch(reject)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function parseRows(data: unknown[][], categories: Category[]): ImportRow[] {
  if (data.length < 2) return []

  const headers = (data[0] as string[]).map(h => String(h ?? '').trim())
  const colMap: Record<number, TestExcelField> = {}
  headers.forEach((h, i) => {
    const field = HEADER_MAP[norm(h)]
    if (field) colMap[i] = field
  })

  const catByName: Record<string, string> = {}
  categories.forEach(c => { catByName[norm(c.th)] = c.id })

  return data.slice(1).map((row, idx) => {
    const r: Record<string, unknown> = {}
    const provided = new Set<TestExcelField>()
    ;(row as unknown[]).forEach((val, i) => {
      const field = colMap[i]
      if (field) {
        provided.add(field)
        r[field] = val === '' || val == null ? null : val
      }
    })

    const priceValue = r.price == null ? null : Number(r.price)
    const idValue = parseId(r.id)
    const activeValue = parseBoolean(r.active)
    const popularValue = parseBoolean(r.popular)
    const available24Value = parseBoolean(r.available_24hr)
    const contactStaffValue = parseBoolean(r.contact_staff)
    const categoryName = optionalText(r.category)
    const categoryIdValue = optionalText(r.category_id)
    let categoryId = categoryIdValue

    if (categoryName) categoryId = catByName[norm(categoryName)] ?? categoryId

    const obj: ImportRow = {
      id: idValue ?? null,
      code: optionalText(r.code) ?? '',
      lis_code: optionalText(r.lis_code),
      cgd: optionalText(r.cgd),
      th: optionalText(r.th) ?? '',
      en: optionalText(r.en),
      short_name: optionalText(r.short_name),
      loinc: optionalText(r.loinc),
      category: categoryName,
      category_id: provided.has('category') || provided.has('category_id') ? categoryId : undefined,
      department: optionalText(r.department),
      active: activeValue,
      popular: popularValue,
      price: priceValue != null && Number.isFinite(priceValue) ? priceValue : null,
      tat_minutes: optionalText(r.tat_minutes),
      urgent_tat_minutes: optionalText(r.urgent_tat_minutes),
      available_24hr: available24Value,
      service: optionalText(r.service),
      method: optionalText(r.method),
      instrument: optionalText(r.instrument),
      methodology_note: optionalText(r.methodology_note),
      tube: optionalText(r.tube),
      tube_color: optionalText(r.tube_color),
      volume: optionalText(r.volume),
      stability: optionalText(r.stability),
      transport_condition: optionalText(r.transport_condition),
      reject: optionalText(r.reject),
      specimen_note: optionalText(r.specimen_note),
      ref: optionalText(r.ref),
      ref_note: optionalText(r.ref_note),
      description: optionalText(r.description),
      contact_name: optionalText(r.contact_name),
      contact_phone: optionalText(r.contact_phone),
      contact_email: optionalText(r.contact_email),
      contact_note: optionalText(r.contact_note),
      contact_staff: contactStaffValue,
      _fields: [...provided],
      _status: 'ok',
      _rowNum: idx + 2,
    }

    // "ตลอด 24 ชั่วโมง" in the service column → checkbox flag
    if (!provided.has('available_24hr') && obj.service && obj.service.includes('24')) {
      obj.available_24hr = true
      obj.service = null
      if (!obj._fields?.includes('available_24hr')) obj._fields?.push('available_24hr')
    }

    const errors: string[] = []
    if (!obj.code) errors.push('ไม่มีรหัส')
    if (!obj.th) errors.push('ไม่มีชื่อรายการตรวจ')
    if (provided.has('id') && idValue === undefined) errors.push('ID ระบบไม่ถูกต้อง')
    if (provided.has('price') && r.price != null && !Number.isFinite(priceValue)) errors.push('ราคาไม่ใช่ตัวเลข')
    if (provided.has('active') && activeValue === undefined) errors.push('ค่าเปิดใช้งานต้องเป็น ใช่/ไม่ใช่')
    if (provided.has('popular') && popularValue === undefined) errors.push('ค่ารายการยอดนิยมต้องเป็น ใช่/ไม่ใช่')
    if (provided.has('available_24hr') && available24Value === undefined) errors.push('ค่าตลอด 24 ชั่วโมงต้องเป็น ใช่/ไม่ใช่')
    if (provided.has('contact_staff') && contactStaffValue === undefined) errors.push('ค่าติดต่อเจ้าหน้าที่ต้องเป็น ใช่/ไม่ใช่')
    if (categoryName && !categoryId) errors.push('ไม่พบหมวดหมู่ที่ระบุ')
    if (errors.length > 0) {
      obj._status = 'error'
      obj._error = errors.join(' · ')
    }

    return obj
  }).filter(r => r.code || r.th) // skip blank rows
}

interface Props { categories: Category[] }

const DROP_STYLE: React.CSSProperties = {
  border: '2px dashed var(--border)', borderRadius: 12, padding: '48px 24px',
  textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s',
}

export function TestImport({ categories }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; created: number; updated: number; errors: { row: number; error: string }[] } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { showToast('รองรับเฉพาะไฟล์ .xlsx, .xls, .csv'); return }
    try {
      setFileName(file.name)
      const data = await parseExcel(file)
      setRows(parseRows(data, categories))
      setResult(null)
    } catch {
      setRows([])
      showToast('อ่านไฟล์ไม่สำเร็จ ตรวจสอบว่าไฟล์เป็น Excel หรือ CSV ที่ไม่เสียหาย')
    }
  }, [categories])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function downloadTemplate() {
    const XLSX = await import('xlsx')

    // Sheet 1: Data template
    const headers = TEST_EXCEL_COLUMNS.map(column => column.header)
    const example: Partial<Record<TestExcelField, string | number>> = {
      code: 'CBC-001', cgd: '30101', th: 'Complete Blood Count', en: 'CBC',
      category: 'โลหิตวิทยาคลินิก', department: 'โลหิตวิทยาคลินิก', active: 'ใช่', popular: 'ไม่ใช่',
      price: 90, tat_minutes: '60 นาที', available_24hr: 'ใช่', tube: 'EDTA (ม่วง)', volume: '3 mL',
      method: 'Hematology analyzer', ref: '4.0–11.0 × 10⁹/L', specimen_note: 'ข้อมูลเพิ่มเติมหรือข้อควรระวัง',
      contact_staff: 'ไม่ใช่',
    }
    const exampleRow = TEST_EXCEL_COLUMNS.map(column => example[column.key] ?? '')
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
    ws['!cols'] = TEST_EXCEL_COLUMNS.map(column => ({ wch: column.width }))
    headers.forEach((_, i) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: i })
      if (ws[cell]) ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'DBEAFE' } } }
    })

    // Sheet 2: หมวดหมู่ reference
    const catRows: string[][] = [['หมวดหมู่ (ชื่อภาษาไทย)', 'ชื่ออังกฤษ']]
    categories.forEach(c => catRows.push([c.th, c.en ?? '']))
    const wsCat = XLSX.utils.aoa_to_sheet(catRows)
    wsCat['!cols'] = [{ wch: 28 }, { wch: 28 }]
    const catHeaderCells = ['A1', 'B1']
    catHeaderCells.forEach(addr => {
      if (wsCat[addr]) wsCat[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D1FAE5' } } }
    })

    // Sheet 3: specimen reference
    const specimenList = [
      'Sodium citrate (ฟ้า)', 'Clotted blood (แดง)', 'Lithium heparin (เขียว)',
      'EDTA (ม่วง)', 'NaF (เทา)', 'Urine', 'Stool',
      'Hemoculture aerobic (ผู้ใหญ่)', 'Hemoculture aerobic (เด็ก)', 'Hemoculture fungi/TB',
      'Blood gas syringe', 'Blood gas capillary tube', 'Cowin tube', 'Random urine',
      'Body Fluid', 'CSF', 'Sputum', 'อื่นๆ',
    ]
    const specimenRows: string[][] = [['specimen (ค่าที่ใช้ได้)']]
    specimenList.forEach(s => specimenRows.push([s]))
    const wsSpec = XLSX.utils.aoa_to_sheet(specimenRows)
    wsSpec['!cols'] = [{ wch: 32 }]
    if (wsSpec['A1']) wsSpec['A1'].s = { font: { bold: true }, fill: { fgColor: { rgb: 'FEF3C7' } } }

    // Sheet 4: import rules
    const instructionRows: (string | number)[][] = [
      ['หัวข้อ', 'รายละเอียด'],
      ['ID ระบบ', 'ถ้ามีค่า แถวนี้จะอัปเดตรายการเดิม ห้ามแก้ไขหรือลบคอลัมน์นี้'],
      ['รายการใหม่', 'เว้น ID ระบบว่าง แล้วกรอกรหัสและชื่อรายการตรวจ'],
      ['ข้อมูลซ้ำ', 'รหัสและชื่อรายการตรวจต้องไม่ซ้ำกันภายในหมวดหมู่เดียวกัน'],
      ['ค่าตัวเลือก', 'ช่อง ใช่/ไม่ใช่ รองรับทั้งภาษาไทยและ true/false'],
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(instructionRows)
    wsInfo['!cols'] = [{ wch: 18 }, { wch: 90 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'รายการตรวจ')
    XLSX.utils.book_append_sheet(wb, wsCat, 'หมวดหมู่')
    XLSX.utils.book_append_sheet(wb, wsSpec, 'specimen')
    XLSX.utils.book_append_sheet(wb, wsInfo, 'คำแนะนำ')
    XLSX.writeFile(wb, 'test-import-template.xlsx')
  }

  async function handleImport() {
    const valid = rows.filter(r => r._status === 'ok')
    if (!valid.length) return
    setImporting(true)
    try {
      const res = await fetch('/api/admin/tests/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: valid }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เกิดข้อผิดพลาด')
      setResult({
        imported: Number(json.imported ?? 0),
        created: Number(json.created ?? 0),
        updated: Number(json.updated ?? 0),
        errors: Array.isArray(json.errors) ? json.errors : [],
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setImporting(false)
    }
  }

  const okCount = rows.filter(r => r._status === 'ok').length
  const errCount = rows.filter(r => r._status === 'error').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && (
        <div role="alert" aria-live="assertive" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#B91C1C', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
          {toast}
        </div>
      )}

      {result ? (
        <Card padding={28}>
          <div style={{ textAlign: 'center', marginBottom: result.errors.length > 0 ? 20 : 0 }}>
            <div style={{
              width: 48, height: 48, margin: '0 auto 10px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: result.imported > 0 ? '#166534' : '#B91C1C',
              background: result.imported > 0 ? '#DCFCE7' : '#FEE2E2',
            }}>
              <Icon name={result.imported > 0 ? 'check' : 'x'} size={24} stroke={2.2} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              นำเข้าสำเร็จ {result.imported} รายการ
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              เพิ่มใหม่ {result.created} รายการ · แก้ไขเดิม {result.updated} รายการ
            </div>
            {result.errors.length > 0 && (
              <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
                ไม่สำเร็จ {result.errors.length} รายการ
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
              {result.imported > 0 && <Button variant="primary" onClick={() => router.push('/staff/tests')}>ดูรายการตรวจ</Button>}
              <Button variant="secondary" onClick={() => { setRows([]); setFileName(''); setResult(null) }}>นำเข้าไฟล์ใหม่</Button>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>รายละเอียด Error</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '6px 10px', borderRadius: 6, background: '#FEF2F2' }}>
                    <span style={{ color: '#DC2626', fontWeight: 700, flexShrink: 0 }}>แถว {e.row}</span>
                    <span style={{ color: '#7F1D1D' }}>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : rows.length === 0 ? (
        <Card padding={0}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); downloadTemplate() }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#2563EB', background: 'none', border: '1px solid #BFDBFE', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Icon name="download" size={14} />
              ดาวน์โหลด Template
            </button>
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label="เลือกไฟล์ Excel หรือ CSV สำหรับนำเข้า"
            style={{ ...DROP_STYLE, borderColor: dragOver ? 'var(--primary)' : 'var(--border)', margin: '0 0 0 0' }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
          >
            <Icon name="upload" size={36} style={{ color: 'var(--primary)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
              ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>รองรับ .xlsx, .xls, .csv</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              aria-label="เลือกไฟล์ Excel หรือ CSV"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>รองรับหัวคอลัมน์ (row แรก)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEST_EXCEL_COLUMNS.filter(column => !['id', 'category_id'].includes(column.key)).map((column) => (
                <span key={column.key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: ['code', 'th'].includes(column.key) ? '#DBEAFE' : 'var(--surface-2)', color: ['code', 'th'].includes(column.key) ? '#1D4ED8' : 'var(--muted)', fontWeight: ['code', 'th'].includes(column.key) ? 600 : 400 }}>
                  {column.header}{['code', 'th'].includes(column.key) ? ' *' : ''}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)' }}>
              ถ้าเป็นไฟล์ที่ Export จากระบบ ค่า <strong style={{ color: 'var(--ink)' }}>ID ระบบ</strong> จะใช้แก้ไขรายการเดิม ส่วนแถวที่เว้น ID ระบบว่างจะถือเป็นรายการใหม่
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card padding={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fileName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  พบ {rows.length} แถว —{' '}
                  <span style={{ color: '#16A34A' }}>พร้อมนำเข้า {okCount} รายการ</span>
                  {rows.some(r => r._status === 'ok' && r.id != null) && <span style={{ color: '#2563EB' }}> · แก้ไขเดิม {rows.filter(r => r._status === 'ok' && r.id != null).length}</span>}
                  {rows.some(r => r._status === 'ok' && r.id == null) && <span style={{ color: '#0F766E' }}> · เพิ่มใหม่ {rows.filter(r => r._status === 'ok' && r.id == null).length}</span>}
                  {errCount > 0 && <span style={{ color: '#DC2626' }}> · ข้ามได้ {errCount} รายการ (ข้อมูลไม่ครบ)</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => { setRows([]); setFileName('') }}>เปลี่ยนไฟล์</Button>
                <Button variant="primary" size="sm" onClick={handleImport} disabled={importing || okCount === 0}>
                  {importing ? 'กำลังนำเข้า...' : `นำเข้า ${okCount} รายการ`}
                </Button>
              </div>
            </div>
          </Card>

          <StickyScroll style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['แถว', 'โหมด', 'รหัส', 'ชื่อรายการตรวจ', 'หน่วยงาน', 'หมวดหมู่', 'Specimen', 'ราคา', 'TAT', 'สถานะ'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._rowNum} style={{ borderBottom: '1px solid var(--border)', opacity: r._status === 'error' ? 0.5 : 1 }}>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: 11 }}>{r._rowNum}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: r.id != null ? '#DBEAFE' : '#CCFBF1', color: r.id != null ? '#1D4ED8' : '#0F766E', fontWeight: 600 }}>
                        {r.id != null ? 'แก้ไข' : 'เพิ่มใหม่'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#2563EB' }}>{r.code}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{r.th}</div>
                      {r.en && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.en}</div>}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.department ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.category ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.tube ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.price != null ? `฿${r.price}` : '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.tat_minutes ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {r._status === 'ok'
                        ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#DCFCE7', color: '#16A34A', fontWeight: 600 }}>พร้อม</span>
                        : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626', fontWeight: 600 }} title={r._error}>ข้าม — {r._error}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StickyScroll>
        </>
      )}
    </div>
  )
}
