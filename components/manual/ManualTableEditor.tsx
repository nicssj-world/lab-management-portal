'use client'
import { useState, useRef } from 'react'
import type { TableSchema, TableColumn, EditableRow } from '@/app/(public)/manual/tables'
import { sanitizeInlineHtml } from '@/lib/html-sanitize'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, display: 'block',
}
function btn(bg: string, fg: string, border = 'transparent'): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, background: bg, color: fg,
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }
}
function emptyRow(schema: TableSchema): EditableRow {
  const r: EditableRow = {}
  for (const c of schema.columns) r[c.key] = c.kind === 'lines' ? [''] : ''
  return r
}

/** Single-line contentEditable with a Bold button, stores sanitized inline HTML. */
function RichLine({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button type="button" title="ตัวหนา"
        onMouseDown={e => { e.preventDefault(); document.execCommand('bold') }}
        style={{ ...btn('var(--surface-2)', 'var(--ink)', 'var(--border)'), width: 30, fontWeight: 900 }}>B</button>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => onChange(sanitizeInlineHtml(ref.current?.innerHTML ?? ''))}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ ...inputStyle, minHeight: 20 }} />
    </div>
  )
}

export function ManualTableEditor({
  schema, rows, onSaved, onCancel,
}: { schema: TableSchema; rows: EditableRow[]; onSaved: (rows: EditableRow[]) => void; onCancel: () => void }) {
  const hasLang = schema.columns.some(c => c.lang)
  const [editLang, setEditLang] = useState<'th' | 'en'>('th')
  const [draft, setDraft] = useState<EditableRow[]>(() => rows.length ? rows.map(r => ({ ...r })) : [emptyRow(schema)])
  const [saving, setSaving] = useState(false)

  const visibleCols = (c: TableColumn) => !c.lang || c.lang === editLang

  function setCell(i: number, key: string, value: string | string[]) {
    setDraft(d => d.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)))
  }
  function move(i: number, dir: -1 | 1) {
    setDraft(d => {
      const next = [...d]; const j = i + dir
      if (j < 0 || j >= next.length) return d
      ;[next[i], next[j]] = [next[j], next[i]]; return next
    })
  }

  async function persist(payloadRows: EditableRow[]) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/manual/${schema.sectionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_data: { [schema.id]: payloadRows } }),
      })
      if (!res.ok) { alert((await res.json()).error ?? 'บันทึกไม่สำเร็จ'); return }
      const json = await res.json()
      onSaved((json.table_data?.[schema.id] as EditableRow[]) ?? payloadRows)
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ border: '2px solid var(--primary)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--primary)', color: '#fff', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>แก้ตาราง — {schema.title}</span>
        {hasLang && (['th', 'en'] as const).map(l => (
          <button key={l} onClick={() => setEditLang(l)}
            style={{ padding: '3px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              background: editLang === l ? '#fff' : 'rgba(255,255,255,.2)', color: editLang === l ? 'var(--primary)' : '#fff' }}>
            {l === 'th' ? 'ภาษาไทย' : 'English'}
          </button>
        ))}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--card)' }}>
        {draft.map((row, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', flex: 1 }}>แถวที่ {i + 1}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} style={btn('var(--surface-2)', 'var(--ink)', 'var(--border)')}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} style={btn('var(--surface-2)', 'var(--ink)', 'var(--border)')}>↓</button>
              <button onClick={() => setDraft(d => d.filter((_, idx) => idx !== i))} style={btn('transparent', 'var(--danger)', 'var(--danger)')}>ลบ</button>
            </div>
            {schema.columns.filter(visibleCols).map(col => (
              <div key={col.key}>
                <label style={labelStyle}>{col.label}</label>
                {col.kind === 'text' ? (
                  <input style={inputStyle} value={String(row[col.key] ?? '')}
                    onChange={e => setCell(i, col.key, e.target.value)} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {((row[col.key] as string[] | undefined) ?? ['']).map((line, li) => (
                      <div key={li} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <RichLine html={line} onChange={html => {
                            const arr = [...((row[col.key] as string[] | undefined) ?? [''])]; arr[li] = html; setCell(i, col.key, arr)
                          }} />
                        </div>
                        <button onClick={() => {
                          const arr = ((row[col.key] as string[] | undefined) ?? ['']).filter((_, x) => x !== li)
                          setCell(i, col.key, arr.length ? arr : [''])
                        }} style={btn('transparent', 'var(--danger)', 'var(--danger)')}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => setCell(i, col.key, [...((row[col.key] as string[] | undefined) ?? ['']), ''])}
                      style={{ ...btn('var(--primary-soft)', 'var(--primary)'), alignSelf: 'flex-start' }}>＋ เพิ่มบรรทัด</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        <button onClick={() => setDraft(d => [...d, emptyRow(schema)])}
          style={{ ...btn('var(--primary-soft)', 'var(--primary)'), alignSelf: 'flex-start' }}>＋ เพิ่มแถว</button>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
        <button disabled={saving} onClick={() => persist(draft)} style={btn('var(--primary)', '#fff')}>บันทึก</button>
        <button disabled={saving} onClick={onCancel} style={btn('var(--card)', 'var(--ink)', 'var(--border)')}>ยกเลิก</button>
        <button disabled={saving}
          onClick={() => { if (confirm('ล้างข้อมูลที่แก้ และกลับไปใช้ค่าต้นฉบับ?')) persist([]) }}
          style={{ ...btn('transparent', 'var(--danger)', 'var(--danger)'), marginLeft: 'auto' }}>ล้าง → ใช้ค่าต้นฉบับ</button>
      </div>
    </div>
  )
}
