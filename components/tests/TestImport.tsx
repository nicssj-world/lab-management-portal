'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Category } from '@/lib/supabase/types'

export interface ImportRow {
  code: string
  cgd?: string
  th: string
  en?: string
  loinc?: string
  category?: string
  price?: number
  tat_minutes?: string
  tube?: string
  volume?: string
  method?: string
  instrument?: string
  ref?: string
  ref_note?: string
  service?: string
  _status: 'ok' | 'error'
  _error?: string
  _rowNum: number
}

// Normalize header for matching
function norm(s: string) {
  return s.toLowerCase().replace(/[\s\-_()/]/g, '')
}

const HEADER_MAP: Record<string, keyof Omit<ImportRow, '_status' | '_error' | '_rowNum'>> = {
  'รหัส': 'code', 'รหัสการทดสอบ': 'code', 'รหัสephis': 'code', 'ephis': 'code', 'code': 'code', 'testcode': 'code',
  'รหัสกรมบัญชีกลาง': 'cgd', 'cgd': 'cgd', 'รหัสcgd': 'cgd',
  'ชื่อรายการตรวจ': 'th', 'ชื่อไทย': 'th', 'ชื่อภาษาไทย': 'th', 'th': 'th', 'ชื่อ': 'th',
  'ชื่ออังกฤษ': 'en', 'ชื่อเต็ม': 'en', 'en': 'en', 'english': 'en', 'ชื่อเต็มชื่ออื่นๆ': 'en',
  'loinc': 'loinc',
  'หมวดหมู่': 'category', 'category': 'category',
  'ราคา': 'price', 'price': 'price',
  'tat': 'tat_minutes', 'tatนาที': 'tat_minutes', 'tatminutes': 'tat_minutes', 'tat_minutes': 'tat_minutes',
  'specimen': 'tube', 'tube': 'tube', 'ชนิดspecimen': 'tube', 'ชนิดsspecimen': 'tube',
  'ปริมาตร': 'volume', 'volume': 'volume',
  'วิธีการ': 'method', 'method': 'method', 'หลักการทดสอบ': 'method',
  'เครื่องมือ': 'instrument', 'instrument': 'instrument',
  'ค่าอ้างอิง': 'ref', 'ref': 'ref', 'referencRange': 'ref', 'referencerange': 'ref',
  'หมายเหตุ': 'ref_note', 'refnote': 'ref_note', 'note': 'ref_note',
  'วันเวลาที่ตรวจ': 'service', 'service': 'service', 'วันเวลาที่ตรวจวิเคราะห์': 'service',
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
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
          resolve(data as Record<string, unknown>[][])
        })
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
  const colMap: Record<number, keyof Omit<ImportRow, '_status' | '_error' | '_rowNum'>> = {}
  headers.forEach((h, i) => {
    const field = HEADER_MAP[norm(h)]
    if (field) colMap[i] = field
  })

  const catByName: Record<string, string> = {}
  categories.forEach(c => { catByName[c.th.toLowerCase()] = c.id })

  return data.slice(1).map((row, idx) => {
    const r: Record<string, unknown> = {}
    ;(row as unknown[]).forEach((val, i) => {
      const field = colMap[i]
      if (field) r[field] = val === '' ? undefined : val
    })

    const obj: ImportRow = {
      code: String(r.code ?? '').trim(),
      th: String(r.th ?? '').trim(),
      cgd: r.cgd ? String(r.cgd).trim() : undefined,
      en: r.en ? String(r.en).trim() : undefined,
      loinc: r.loinc ? String(r.loinc).trim() : undefined,
      category: r.category ? String(r.category).trim() : undefined,
      price: r.price != null ? Number(r.price) || undefined : undefined,
      tat_minutes: r.tat_minutes ? String(r.tat_minutes).trim() : undefined,
      tube: r.tube ? String(r.tube).trim() : undefined,
      volume: r.volume ? String(r.volume).trim() : undefined,
      method: r.method ? String(r.method).trim() : undefined,
      instrument: r.instrument ? String(r.instrument).trim() : undefined,
      ref: r.ref ? String(r.ref).trim() : undefined,
      ref_note: r.ref_note ? String(r.ref_note).trim() : undefined,
      service: r.service ? String(r.service).trim() : undefined,
      _status: 'ok',
      _rowNum: idx + 2,
    }

    if (!obj.code) { obj._status = 'error'; obj._error = 'ไม่มีรหัส' }
    else if (!obj.th) { obj._status = 'error'; obj._error = 'ไม่มีชื่อรายการตรวจ' }

    // Resolve category name → id (stored for API use)
    if (obj.category) {
      const catId = catByName[obj.category.toLowerCase()]
      if (catId) (obj as unknown as Record<string, unknown>).category_id = catId
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
  const [result, setResult] = useState<{ imported: number; errors: { row: number; error: string }[] } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { showToast('รองรับเฉพาะไฟล์ .xlsx, .xls, .csv'); return }
    setFileName(file.name)
    const data = await parseExcel(file)
    setRows(parseRows(data, categories))
    setResult(null)
  }, [categories])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function downloadTemplate() {
    const XLSX = await import('xlsx')

    // Sheet 1: Data template
    const headers = [
      'รหัส', 'รหัสกรมบัญชีกลาง', 'ชื่อรายการตรวจ', 'ชื่ออังกฤษ', 'LOINC',
      'หมวดหมู่', 'TAT', 'specimen', 'ปริมาตร',
      'วิธีการ', 'ค่าอ้างอิง', 'วันเวลาที่ตรวจ', 'ราคา',
    ]
    const example = [
      'CBC-001', '30101', 'Complete Blood Count', 'CBC', '',
      'โลหิตวิทยาคลินิก', '60 นาที', 'EDTA (ม่วง)', '3 mL',
      'Hematology analyzer', '4.0–11.0 × 10⁹/L', 'ตลอด 24 ชั่วโมง', 90,
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = headers.map((_, i) => ({ wch: [10, 20, 26, 24, 10, 20, 14, 22, 10, 22, 20, 18, 8][i] }))
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
      'Blood gas syringe', 'Blood gas capillary tube', 'Cowin tube', 'Random urine', 'อื่นๆ',
    ]
    const specimenRows: string[][] = [['specimen (ค่าที่ใช้ได้)']]
    specimenList.forEach(s => specimenRows.push([s]))
    const wsSpec = XLSX.utils.aoa_to_sheet(specimenRows)
    wsSpec['!cols'] = [{ wch: 32 }]
    if (wsSpec['A1']) wsSpec['A1'].s = { font: { bold: true }, fill: { fgColor: { rgb: 'FEF3C7' } } }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'รายการตรวจ')
    XLSX.utils.book_append_sheet(wb, wsCat, 'หมวดหมู่')
    XLSX.utils.book_append_sheet(wb, wsSpec, 'specimen')
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
      setResult(json)
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
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#B91C1C', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
          {toast}
        </div>
      )}

      {result ? (
        <Card padding={28}>
          <div style={{ textAlign: 'center', marginBottom: result.errors.length > 0 ? 20 : 0 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{result.imported > 0 ? '✓' : '✗'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              นำเข้าสำเร็จ {result.imported} รายการ
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
              ⬇ ดาวน์โหลด Template
            </button>
          </div>
          <div
            style={{ ...DROP_STYLE, borderColor: dragOver ? 'var(--primary)' : 'var(--border)', margin: '0 0 0 0' }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
              ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>รองรับ .xlsx, .xls, .csv</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>รองรับหัวคอลัมน์ (row แรก)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                ['รหัส / code', 'required'],
                ['ชื่อรายการตรวจ / th', 'required'],
                ['รหัสกรมบัญชีกลาง / cgd', ''],
                ['ชื่ออังกฤษ / en', ''],
                ['LOINC', ''],
                ['หมวดหมู่ / category', ''],
                ['TAT', ''],
                ['specimen / tube', ''],
                ['ปริมาตร / volume', ''],
                ['วิธีการ / method', ''],
                ['ค่าอ้างอิง / ref', ''],
                ['วันเวลาที่ตรวจ / service', ''],
                ['ราคา / price', ''],
              ].map(([label, req]) => (
                <span key={label} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: req ? '#DBEAFE' : 'var(--surface-2)', color: req ? '#1D4ED8' : 'var(--muted)', fontWeight: req ? 600 : 400 }}>
                  {label}{req ? ' *' : ''}
                </span>
              ))}
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

          <div style={{ overflowX: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['แถว', 'รหัส', 'ชื่อรายการตรวจ', 'หมวดหมู่', 'Specimen', 'ราคา', 'TAT', 'สถานะ'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._rowNum} style={{ borderBottom: '1px solid var(--border)', opacity: r._status === 'error' ? 0.5 : 1 }}>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: 11 }}>{r._rowNum}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#2563EB' }}>{r.code}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{r.th}</div>
                      {r.en && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.en}</div>}
                    </td>
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
          </div>
        </>
      )}
    </div>
  )
}
