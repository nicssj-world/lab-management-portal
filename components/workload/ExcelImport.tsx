'use client'

import { useState, useRef, useCallback } from 'react'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { Button } from '@/components/ui/Button'

interface ParsedRow {
  test_name: string
  month: number
  in_time_count: number
  total_count: number
  status: 'ok' | 'unmatched' | 'invalid'
  test_id?: number
  error?: string
}

interface DeptOption {
  id: number
  code: string
  name: string
}

interface Props {
  departments: DeptOption[]
}

export function ExcelImport({ departments }: Props) {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [deptId, setDeptId] = useState<number | null>(departments[0]?.id ?? null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const MONTH_COLS: Record<string, number> = {
    '10': 10, '11': 11, '12': 12,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'ต.ค.': 10, 'ต.ค': 10, 'พ.ย.': 11, 'พ.ย': 11, 'ธ.ค.': 12, 'ธ.ค': 12,
    'ม.ค.': 1, 'ม.ค': 1, 'ก.พ.': 2, 'ก.พ': 2, 'มี.ค.': 3, 'มี.ค': 3,
    'เม.ย.': 4, 'เม.ย': 4, 'พ.ค.': 5, 'พ.ค': 5, 'มิ.ย.': 6, 'มิ.ย': 6,
    'ก.ค.': 7, 'ก.ค': 7, 'ส.ค.': 8, 'ส.ค': 8, 'ก.ย.': 9, 'ก.ย': 9,
  }

  async function parseFile(file: File) {
    if (!deptId) { setToast({ type: 'error', msg: 'กรุณาเลือกแผนกก่อน' }); return }

    setToast(null)
    setRows([])

    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { header: 1, defval: '' })

    if (raw.length < 2) { setToast({ type: 'error', msg: 'ไม่พบข้อมูลในไฟล์' }); return }

    const headers = (raw[0] as unknown as (string | number)[]).map(h => String(h).trim())
    const testNameCol = headers.findIndex(h => /ชื่อ|test.?name|name|รายการ/i.test(h))
    if (testNameCol === -1) { setToast({ type: 'error', msg: 'ไม่พบคอลัมน์ "ชื่อรายการตรวจ"' }); return }

    // detect month columns
    const monthColMap: { colIdx: number; month: number }[] = []
    headers.forEach((h, i) => {
      if (i === testNameCol) return
      const key = h.trim()
      if (MONTH_COLS[key] !== undefined) monthColMap.push({ colIdx: i, month: MONTH_COLS[key] })
    })

    if (monthColMap.length === 0) {
      setToast({ type: 'error', msg: 'ไม่พบคอลัมน์เดือน (ใช้ชื่อ: 10, 11, ..., 9 หรือ ต.ค., พ.ย., ...)' })
      return
    }

    // fetch tests for this dept to resolve test_id
    const testsRes = await fetch(`/lab-workload/api/departments?tests=1&dept_id=${deptId}`)
    const tests: { id: number; test_name: string }[] = testsRes.ok ? await testsRes.json() : []

    const parsed: ParsedRow[] = []
    for (let rowIdx = 1; rowIdx < raw.length; rowIdx++) {
      const dataRow = raw[rowIdx] as unknown as (string | number)[]
      const test_name = String(dataRow[testNameCol] ?? '').trim()
      if (!test_name) continue

      const matched = tests.filter(t => t.test_name.toLowerCase() === test_name.toLowerCase())

      for (const { colIdx, month } of monthColMap) {
        const cellVal = String(dataRow[colIdx] ?? '').trim()
        if (!cellVal) continue

        // support "145/160" fraction format
        let in_time_count: number
        let total_count: number

        if (cellVal.includes('/')) {
          const [a, b] = cellVal.split('/').map(s => parseInt(s.trim()))
          if (isNaN(a) || isNaN(b)) {
            parsed.push({ test_name, month, in_time_count: 0, total_count: 0, status: 'invalid', error: `รูปแบบไม่ถูกต้อง: "${cellVal}"` })
            continue
          }
          in_time_count = a
          total_count = b
        } else {
          const num = parseInt(cellVal)
          if (isNaN(num)) {
            parsed.push({ test_name, month, in_time_count: 0, total_count: 0, status: 'invalid', error: `รูปแบบไม่ถูกต้อง: "${cellVal}"` })
            continue
          }
          in_time_count = num
          total_count = num
        }

        if (in_time_count > total_count) {
          parsed.push({ test_name, month, in_time_count, total_count, status: 'invalid', error: 'in_time > total' })
          continue
        }

        if (matched.length === 0) {
          parsed.push({ test_name, month, in_time_count, total_count, status: 'unmatched' })
        } else {
          parsed.push({ test_name, month, in_time_count, total_count, status: 'ok', test_id: matched[0].id })
        }
      }
    }

    setRows(parsed)
  }

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      setToast({ type: 'error', msg: 'รองรับเฉพาะไฟล์ .xlsx และ .xls' })
      return
    }
    parseFile(file)
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.status === 'ok' && r.test_id !== undefined)
    if (!validRows.length) return

    setImporting(true)
    setToast(null)
    try {
      const entries = validRows.map(r => ({
        test_id: r.test_id!,
        fiscal_year: year,
        month: r.month,
        in_time_count: r.in_time_count,
        total_count: r.total_count,
      }))

      const res = await fetch('/lab-workload/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'นำเข้าไม่สำเร็จ')
      }

      setToast({ type: 'success', msg: `นำเข้าสำเร็จ ${validRows.length} รายการ` })
      setRows([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: unknown) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' })
    } finally {
      setImporting(false)
    }
  }

  const okCount = rows.filter(r => r.status === 'ok').length
  const unmatchedCount = rows.filter(r => r.status === 'unmatched').length
  const invalidCount = rows.filter(r => r.status === 'invalid').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer' }}
        >
          {[getCurrentThaiFiscalYear(), getCurrentThaiFiscalYear() - 1].map(y => (
            <option key={y} value={y}>ปีงบ {y}</option>
          ))}
        </select>
        <select
          value={deptId ?? ''}
          onChange={e => setDeptId(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer' }}
        >
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'var(--primary-soft)' : 'var(--surface-2)',
          transition: 'all .15s',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>รองรับ .xlsx และ .xls</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>คอลัมน์: ชื่อรายการตรวจ, 10, 11, 12, 1, ... 9 (หรือ ต.ค., พ.ย., ...)</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>ค่าในช่อง: "145/160" (in_time/total) หรือตัวเลขเดี่ยว</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      {toast && (
        <div style={{
          background: toast.type === 'success' ? '#D1FAE5' : '#FEE2E2',
          border: `1px solid ${toast.type === 'success' ? '#6EE7B7' : '#FCA5A5'}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 13,
          color: toast.type === 'success' ? '#065F46' : '#991B1B',
        }}>
          {toast.msg}
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: '#065F46', background: '#D1FAE5', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>✓ พร้อมนำเข้า {okCount} รายการ</span>
            {unmatchedCount > 0 && <span style={{ color: '#92400E', background: '#FEF3C7', padding: '4px 10px', borderRadius: 6 }}>⚠ ไม่พบรายการ {unmatchedCount}</span>}
            {invalidCount > 0 && <span style={{ color: '#991B1B', background: '#FEE2E2', padding: '4px 10px', borderRadius: 6 }}>✕ ข้อมูลผิดพลาด {invalidCount}</span>}
          </div>

          {/* Preview table */}
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)', maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                  {['ชื่อรายการตรวจ', 'เดือน', 'ตาม TAT', 'ทั้งหมด', 'สถานะ'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: r.status === 'invalid' ? '#FFF5F5' : r.status === 'unmatched' ? '#FFFBEB' : undefined }}>
                    <td style={{ padding: '8px 14px', color: 'var(--ink)' }}>{r.test_name}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--muted)' }}>{r.month}</td>
                    <td style={{ padding: '8px 14px' }}>{r.in_time_count.toLocaleString()}</td>
                    <td style={{ padding: '8px 14px' }}>{r.total_count.toLocaleString()}</td>
                    <td style={{ padding: '8px 14px' }}>
                      {r.status === 'ok' && <span style={{ color: '#16A34A', fontSize: 12 }}>✓ ตรงกัน</span>}
                      {r.status === 'unmatched' && <span style={{ color: '#D97706', fontSize: 12 }}>⚠ ไม่พบรายการ (ข้าม)</span>}
                      {r.status === 'invalid' && <span style={{ color: '#DC2626', fontSize: 12 }}>✕ {r.error}</span>}
                    </td>
                  </tr>
                ))}
                {rows.length > 200 && (
                  <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>แสดง 200 แถวแรก จาก {rows.length} แถว</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={okCount === 0 || importing}
            >
              {importing ? 'กำลังนำเข้า...' : `นำเข้า ${okCount} รายการ`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
