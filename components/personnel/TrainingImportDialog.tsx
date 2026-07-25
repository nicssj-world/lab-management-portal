'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { StaffTraining } from '@/lib/supabase/types'
import type {
  HisTrainingFilePreview,
  HisTrainingImportSummary,
  HisTrainingPreviewRow,
} from '@/lib/personnel/his-training-import'

type ImportResult = {
  batchId: string
  inserted: number
  skipped: number
  errors: number
  created: StaffTraining[]
}

type Props = {
  mode: 'self' | 'bulk'
  profileId?: string
  onClose: () => void
  onImported?: (result: ImportResult) => void
}

const button: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  minHeight: 38, padding: '0 14px', borderRadius: 8, border: 0,
  background: 'var(--primary)', color: '#fff', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const ghost: React.CSSProperties = { ...button, background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }
const th: React.CSSProperties = { padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '9px 10px', fontSize: 12.5, color: 'var(--ink)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }

const STATUS: Record<HisTrainingPreviewRow['status'], { label: string; color: string; bg: string }> = {
  ready: { label: 'พร้อมนำเข้า', color: '#15803D', bg: '#F0FDF4' },
  duplicate: { label: 'มีแล้ว', color: '#475569', bg: '#F1F5F9' },
  conflict: { label: 'ข้อมูลขัดแย้ง', color: '#B45309', bg: '#FFFBEB' },
  error: { label: 'ผิดพลาด', color: '#B91C1C', bg: '#FEF2F2' },
}

function endpoint(action: 'preview' | 'commit', mode: Props['mode'], profileId?: string) {
  const params = new URLSearchParams({ mode })
  if (profileId) params.set('profileId', profileId)
  return `/api/admin/personnel/training-import/${action}?${params}`
}

function makeFormData(files: File[], selected?: Set<string>) {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  if (selected) form.set('selectedKeys', JSON.stringify([...selected]))
  return form
}

function countLabel(summary: HisTrainingImportSummary | null) {
  if (!summary) return ''
  return `พร้อม ${summary.ready} · มีแล้ว ${summary.duplicate} · ขัดแย้ง ${summary.conflict} · ผิดพลาด ${summary.error}`
}

export function TrainingImportDialog({ mode, profileId, onClose, onImported }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [previewFiles, setPreviewFiles] = useState<HisTrainingFilePreview[]>([])
  const [summary, setSummary] = useState<HisTrainingImportSummary | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const rows = useMemo(() => previewFiles.flatMap((file) => file.rows.map((row) => ({ file, row }))), [previewFiles])
  const selectable = rows.filter(({ row }) => row.status === 'ready')

  async function requestPreview() {
    if (files.length === 0) { setError('กรุณาเลือกไฟล์ HIS'); return }
    setBusy('preview'); setError(''); setResult(null)
    try {
      const response = await fetch(endpoint('preview', mode, profileId), { method: 'POST', body: makeFormData(files) })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? 'ตรวจสอบไฟล์ไม่สำเร็จ')
      setPreviewFiles(data.files)
      setSummary(data.summary)
      setSelected(new Set(data.files.flatMap((file: HisTrainingFilePreview) => file.rows.filter((row) => row.status === 'ready').map((row) => row.key))))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ตรวจสอบไฟล์ไม่สำเร็จ')
    } finally { setBusy(null) }
  }

  async function commit() {
    if (selected.size === 0) { setError('เลือกอย่างน้อยหนึ่งรายการเพื่อนำเข้า'); return }
    setBusy('commit'); setError('')
    try {
      const response = await fetch(endpoint('commit', mode, profileId), { method: 'POST', body: makeFormData(files, selected) })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? 'นำเข้าไม่สำเร็จ')
      setResult(data)
      onImported?.(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'นำเข้าไม่สำเร็จ')
    } finally { setBusy(null) }
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(3px)',
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="his-import-title" style={{
        width: 'min(1120px, 100%)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 24px 70px rgba(15,23,42,.28)',
      }}>
        <header style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 id="his-import-title" style={{ margin: 0, fontSize: 17, color: 'var(--ink)' }}>{mode === 'bulk' ? 'นำเข้าการอบรมจาก HIS หลายคน' : 'นำเข้าประวัติการอบรมจาก HIS'}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>ตรวจสอบรายการก่อนบันทึก · ไฟล์ละไม่เกิน 5 MB และ 500 รายการ</p>
          </div>
          <button type="button" aria-label="ปิด" onClick={onClose} disabled={!!busy} style={{ ...ghost, minHeight: 32, width: 32, padding: 0 }}><Icon name="x" size={15} /></button>
        </header>

        <div style={{ padding: 18, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {result ? (
            <div style={{ padding: 18, borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
              <div style={{ fontWeight: 800, marginBottom: 5 }}>นำเข้าสำเร็จ {result.inserted} รายการ</div>
              <div style={{ fontSize: 13 }}>ข้าม {result.skipped} · ผิดพลาด {result.errors} · Batch {result.batchId}</div>
            </div>
          ) : (
            <>
              <label style={{ padding: 16, border: '1px dashed var(--border)', borderRadius: 12, background: 'var(--surface-2)', cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)', fontSize: 13, fontWeight: 700 }}><Icon name="upload" size={17} /> เลือกไฟล์ .xls หรือ .xlsx</span>
                <span style={{ display: 'block', marginTop: 5, color: 'var(--muted)', fontSize: 12 }}>{mode === 'bulk' ? 'เลือกได้สูงสุด 50 ไฟล์ ชื่อไฟล์ต้องตรงกับ E-Phis' : 'ชื่อไฟล์ต้องตรงกับ E-Phis ของเจ้าของโปรไฟล์'}</span>
                <input
                  type="file" accept=".xls,.xlsx" multiple={mode === 'bulk'} hidden
                  onChange={(event) => {
                    setFiles(Array.from(event.target.files ?? [])); setPreviewFiles([]); setSummary(null); setSelected(new Set()); setError('')
                  }}
                />
              </label>
              {files.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>เลือกแล้ว {files.length} ไฟล์: {files.slice(0, 4).map((file) => file.name).join(', ')}{files.length > 4 ? ` และอีก ${files.length - 4} ไฟล์` : ''}</div>}
              {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}
              {summary && <div style={{ padding: '9px 12px', borderRadius: 9, background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 700 }}>{countLabel(summary)}</div>}

              {previewFiles.some((file) => file.error) && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {previewFiles.filter((file) => file.error).map((file) => (
                    <div key={file.fileName} style={{ padding: '8px 10px', borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 12.5 }}>
                      <strong>{file.fileName}</strong>: {file.error}
                    </div>
                  ))}
                </div>
              )}

              {rows.length > 0 && (
                <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead><tr>
                      <th style={{ ...th, width: 34 }}><input type="checkbox" aria-label="เลือกทั้งหมด" checked={selectable.length > 0 && selectable.every(({ row }) => selected.has(row.key))} onChange={(event) => setSelected(event.target.checked ? new Set(selectable.map(({ row }) => row.key)) : new Set())} /></th>
                      <th style={th}>สถานะ</th>{mode === 'bulk' && <th style={th}>บุคลากร</th>}<th style={th}>หัวข้อ</th><th style={th}>วันที่</th><th style={th}>ชม.</th><th style={th}>ผู้จัด</th>
                    </tr></thead>
                    <tbody>{rows.map(({ file, row }) => {
                      const tone = STATUS[row.status]
                      return <tr key={`${file.fileName}:${row.key}`}>
                        <td style={td}><input type="checkbox" aria-label={`เลือก ${row.topic || row.sourceRecordId}`} disabled={row.status !== 'ready'} checked={selected.has(row.key)} onChange={() => toggle(row.key)} /></td>
                        <td style={td}><span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 999, color: tone.color, background: tone.bg, fontSize: 11, fontWeight: 800 }}>{tone.label}</span>{row.error && <div style={{ marginTop: 4, color: tone.color, fontSize: 11 }}>{row.error}</div>}</td>
                        {mode === 'bulk' && <td style={td}>{file.profileName ?? file.ephisId}</td>}
                        <td style={{ ...td, minWidth: 260, fontWeight: 600 }}>{row.topic || '—'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{row.trainingDate ?? '—'}{row.trainingEndDate && row.trainingEndDate !== row.trainingDate ? ` – ${row.trainingEndDate}` : ''}</td>
                        <td style={td}>{row.hours ?? '—'}</td><td style={td}>{row.provider ?? '—'}</td>
                      </tr>
                    })}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={!!busy} style={ghost}>{result ? 'ปิด' : 'ยกเลิก'}</button>
          {!result && previewFiles.length === 0 && <button type="button" onClick={requestPreview} disabled={!!busy || files.length === 0} style={{ ...button, opacity: busy || files.length === 0 ? .55 : 1 }}>{busy === 'preview' ? 'กำลังตรวจสอบ…' : 'ตรวจสอบไฟล์'}</button>}
          {!result && previewFiles.length > 0 && <button type="button" onClick={commit} disabled={!!busy || selected.size === 0} style={{ ...button, opacity: busy || selected.size === 0 ? .55 : 1 }}>{busy === 'commit' ? 'กำลังนำเข้า…' : `นำเข้า ${selected.size} รายการ`}</button>}
        </footer>
      </section>
    </div>
  )
}
