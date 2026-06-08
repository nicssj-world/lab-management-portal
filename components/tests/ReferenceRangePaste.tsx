'use client'

import { useState, useRef } from 'react'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { decodeTable, type RawTable } from '@/lib/utils/refTable'
export { isJsonTable, decodeTable } from '@/lib/utils/refTable'
export type { RawTable } from '@/lib/utils/refTable'

interface Props {
  value: string | null | undefined
  onChange: (v: string | null | undefined) => void
  note: string | null | undefined
  onNoteChange: (v: string | null | undefined) => void
}

const ta: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
  resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
}

function parseTSV(text: string): RawTable | string {
  const all = text.trim().split(/\r?\n/)
    .map(l => l.split('\t'))
    .filter(r => r.some(c => c.trim()))
  if (all.length === 0) return 'ไม่พบข้อมูล'
  if (all.length === 1) return { h: [], r: all }
  return { h: all[0].map(c => c.trim()), r: all.slice(1) }
}

export function RawTableView({ table }: { table: RawTable }) {
  const colCount = Math.max(table.h.length, ...table.r.map(r => r.length), 1)
  return (
    <StickyScroll style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        {table.h.length > 0 && (
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {Array.from({ length: colCount }, (_, i) => (
                <th key={i} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {table.h[i] ?? ''}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.r.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              {Array.from({ length: colCount }, (_, j) => (
                <td key={j} style={{ padding: '7px 10px' }}>{row[j] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </StickyScroll>
  )
}

export function ReferenceRangePaste({ value, onChange, note, onNoteChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const table = decodeTable(value)

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData('text')
    if (!text.trim()) return
    e.preventDefault()
    const result = parseTSV(text)
    if (typeof result === 'string') {
      setError(result)
    } else {
      setError(null)
      onChange(JSON.stringify(result))
    }
  }

  function handleClear() {
    onChange(undefined)
    setError(null)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {table === null ? (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            คัดลอกตารางจาก Excel แล้ววางที่นี่ — แถวแรกจะเป็นหัวตาราง แถวถัดไปเป็นข้อมูล
          </div>
          <textarea
            ref={textareaRef}
            onPaste={handlePaste}
            placeholder="Ctrl+V / Cmd+V เพื่อวางข้อมูลจาก Excel..."
            style={{ ...ta, minHeight: 100, cursor: 'text' }}
            readOnly
          />
          {error && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{error}</div>}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>นำเข้า {table.r.length} แถว</span>
            <button
              type="button"
              onClick={handleClear}
              style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}
            >
              วางใหม่
            </button>
          </div>
          <RawTableView table={table} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>หมายเหตุ</label>
        <textarea
          style={ta}
          value={note ?? ''}
          onChange={(e) => onNoteChange(e.target.value || null)}
          placeholder="เช่น ค่าอ้างอิงนี้ใช้สำหรับผู้ใหญ่ทั่วไป กรณีเด็ก ตั้งครรภ์ หรือสูงอายุ กรุณาดูเอกสารคู่มือฉบับเต็ม"
        />
      </div>

    </div>
  )
}
