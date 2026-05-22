'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { parseTATFile, autoDetectColumns, getTATFiscalYearMonth } from '@/lib/tat-utils'

type ColumnField = 'received_at' | 'resulted_at' | 'test_code' | 'test_name' | 'dept_code' | 'lab_number'

interface MappedRow {
  lab_number?: string
  test_code?: string
  test_name?: string
  dept_code?: string
  received_at: string
  resulted_at: string
  fiscal_year: number
  month: number
  tat_minutes: number
  valid: boolean
  error?: string
}

interface ColumnMap {
  received_at?: string
  resulted_at?: string
  test_code?: string
  test_name?: string
  dept_code?: string
  lab_number?: string
}

export function TATImportForm() {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [colMap, setColMap] = useState<ColumnMap>({})
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([])
  const [filename, setFilename] = useState('')
  const [existingBatch, setExistingBatch] = useState<{ id: number; row_count: number } | null>(null)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setToast(null)
    setMappedRows([])
    setFilename(file.name)
    try {
      const rows = await parseTATFile(file)
      if (rows.length === 0) { setToast({ type: 'error', msg: 'ไม่พบข้อมูลในไฟล์' }); return }
      const hdrs = Object.keys(rows[0])
      setRawRows(rows)
      setHeaders(hdrs)
      setColMap(autoDetectColumns(hdrs))
    } catch (e: unknown) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'อ่านไฟล์ไม่ได้' })
    }
  }

  const buildMappedRows = useCallback(() => {
    if (!colMap.received_at || !colMap.resulted_at) return

    const rows: MappedRow[] = []
    for (const raw of rawRows) {
      const recvStr = raw[colMap.received_at!]
      const resStr = raw[colMap.resulted_at!]

      if (!recvStr || !resStr) {
        rows.push({ received_at: '', resulted_at: '', fiscal_year: year, month, tat_minutes: 0, valid: false, error: 'ขาดข้อมูลเวลา' })
        continue
      }

      const recv = new Date(recvStr)
      const res = new Date(resStr)
      if (isNaN(recv.getTime()) || isNaN(res.getTime())) {
        rows.push({ received_at: recvStr, resulted_at: resStr, fiscal_year: year, month, tat_minutes: 0, valid: false, error: 'รูปแบบวันที่ไม่ถูกต้อง' })
        continue
      }
      if (res < recv) {
        rows.push({ received_at: recvStr, resulted_at: resStr, fiscal_year: year, month, tat_minutes: 0, valid: false, error: 'resulted_at ก่อน received_at' })
        continue
      }

      const tatMin = Math.round((res.getTime() - recv.getTime()) / 60000)
      const { fiscal_year: fy, month: m } = getTATFiscalYearMonth(recv)

      rows.push({
        lab_number: colMap.lab_number ? raw[colMap.lab_number] : undefined,
        test_code: colMap.test_code ? raw[colMap.test_code] : undefined,
        test_name: colMap.test_name ? raw[colMap.test_name] : undefined,
        dept_code: colMap.dept_code ? raw[colMap.dept_code] : undefined,
        received_at: recv.toISOString(),
        resulted_at: res.toISOString(),
        fiscal_year: fy,
        month: m,
        tat_minutes: tatMin,
        valid: true,
      })
    }
    setMappedRows(rows)
  }, [rawRows, colMap, year, month])

  const validCount = mappedRows.filter(r => r.valid).length
  const invalidCount = mappedRows.filter(r => !r.valid).length

  async function checkExisting() {
    const res = await fetch(`/tat/api/import?year=${year}&month=${month}`)
    const data = await res.json()
    return data.existing as { id: number; row_count: number } | null
  }

  async function handleImport() {
    const validRows = mappedRows.filter(r => r.valid)
    if (!validRows.length) return

    const existing = await checkExisting()
    if (existing) {
      setExistingBatch(existing)
      return
    }

    await doImport(validRows)
  }

  async function doImport(rows: MappedRow[]) {
    setExistingBatch(null)
    setImporting(true)
    setToast(null)
    try {
      const res = await fetch('/tat/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchMeta: { filename, fiscal_year: year, month },
          entries: rows.map(r => ({
            lab_number: r.lab_number,
            test_code: r.test_code,
            test_name: r.test_name,
            dept_code: r.dept_code,
            received_at: r.received_at,
            resulted_at: r.resulted_at,
            fiscal_year: r.fiscal_year,
            month: r.month,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'นำเข้าไม่สำเร็จ')
      }

      const result = await res.json()
      setToast({ type: 'success', msg: `นำเข้าสำเร็จ ${result.insertedCount.toLocaleString()} แถว (Batch #${result.batchId})` })
      setRawRows([])
      setMappedRows([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: unknown) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' })
    } finally {
      setImporting(false)
    }
  }

  const COLUMN_FIELDS: { key: ColumnField; label: string }[] = [
    { key: 'received_at', label: 'เวลารับตัวอย่าง *' },
    { key: 'resulted_at', label: 'เวลารายงานผล *' },
    { key: 'test_code', label: 'รหัสการตรวจ' },
    { key: 'test_name', label: 'ชื่อการตรวจ' },
    { key: 'dept_code', label: 'แผนก/Ward' },
    { key: 'lab_number', label: 'เลข Lab/Barcode' },
  ]

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
    fontSize: 12, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer', minWidth: 140,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Year/Month for batch metadata */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>ปีงบ–เดือนของ Batch:</span>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={selectStyle}
        >
          {[getCurrentThaiFiscalYear(), getCurrentThaiFiscalYear() - 1].map(y => (
            <option key={y} value={y}>ปีงบ {y}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          style={selectStyle}
        >
          {[10,11,12,1,2,3,4,5,6,7,8,9].map(m => (
            <option key={m} value={m}>{m}</option>
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
          background: dragOver ? 'var(--primary-soft)' : 'var(--surface-2)', transition: 'all .15s',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {filename ? `ไฟล์: ${filename}` : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>รองรับ .xlsx, .xls, .txt, .csv</div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.txt,.csv"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
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

      {/* Column mapper */}
      {headers.length > 0 && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
            จับคู่คอลัมน์ ({rawRows.length.toLocaleString()} แถว)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {COLUMN_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <select
                  value={colMap[key] ?? ''}
                  onChange={e => setColMap(prev => ({ ...prev, [key]: e.target.value || undefined }))}
                  style={selectStyle}
                >
                  <option value="">— ไม่เลือก —</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={buildMappedRows}
              disabled={!colMap.received_at || !colMap.resulted_at}
            >
              แสดงตัวอย่าง
            </Button>
          </div>
        </div>
      )}

      {/* Preview table */}
      {mappedRows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: '#065F46', background: '#D1FAE5', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>✓ ถูกต้อง {validCount.toLocaleString()} แถว</span>
            {invalidCount > 0 && <span style={{ color: '#991B1B', background: '#FEE2E2', padding: '4px 10px', borderRadius: 6 }}>✕ ผิดพลาด {invalidCount} แถว (จะถูกข้าม)</span>}
          </div>

          {existingBatch && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: '#92400E', marginBottom: 6 }}>
                ⚠ พบข้อมูลของเดือนนี้แล้ว ({existingBatch.row_count.toLocaleString()} แถว) — การนำเข้าใหม่จะเพิ่มข้อมูลทับ
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="danger" size="sm" onClick={() => doImport(mappedRows.filter(r => r.valid))} disabled={importing}>
                  {importing ? 'กำลังนำเข้า...' : 'ยืนยันการนำเข้าทับ'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setExistingBatch(null)}>ยกเลิก</Button>
              </div>
            </div>
          )}

          <StickyScroll style={{ borderRadius: 12, border: '1px solid var(--border)', maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                  {['เวลารับ', 'เวลารายงาน', 'TAT (นาที)', 'Dept', 'ชื่อการตรวจ', 'สถานะ'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedRows.slice(0, 200).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: !r.valid ? '#FFF5F5' : undefined }}>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11 }}>{r.received_at ? new Date(r.received_at).toLocaleString('th-TH') : r.received_at}</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11 }}>{r.resulted_at ? new Date(r.resulted_at).toLocaleString('th-TH') : r.resulted_at}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: r.tat_minutes > 240 ? '#DC2626' : '#16A34A' }}>{r.valid ? r.tat_minutes : '—'}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--muted)' }}>{r.dept_code ?? '—'}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--ink)' }}>{r.test_name ?? '—'}</td>
                    <td style={{ padding: '7px 12px' }}>
                      {r.valid
                        ? <span style={{ color: '#16A34A', fontSize: 11 }}>✓</span>
                        : <span style={{ color: '#DC2626', fontSize: 11 }}>✕ {r.error}</span>
                      }
                    </td>
                  </tr>
                ))}
                {mappedRows.length > 200 && (
                  <tr><td colSpan={6} style={{ padding: 12, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>แสดง 200 แถวแรก จาก {mappedRows.length.toLocaleString()} แถว</td></tr>
                )}
              </tbody>
            </table>
          </StickyScroll>

          {!existingBatch && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={validCount === 0 || importing}
              >
                {importing ? 'กำลังนำเข้า...' : `นำเข้า ${validCount.toLocaleString()} แถว`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
