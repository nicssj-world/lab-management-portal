'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

interface UploadResult {
  inserted: number
  skipped: number
  skipped_in_file: number
  skipped_in_db: number
  total: number
  errors: string[]
  data_month: string | null
}

interface Props {
  onClose: () => void
  onSuccess: (dataMonth: string | null) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const dialogStyle: React.CSSProperties = {
  background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 480,
  maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

export default function RejectionUploadModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File | null | undefined) {
    if (!f) return
    setFile(f)
    setResult(null)
    setUploadError(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/rejection/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error ?? 'เกิดข้อผิดพลาด')
      } else {
        setResult(json as UploadResult)
      }
    } catch {
      setUploadError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setUploading(false)
    }
  }

  function handleDone() {
    if (result && result.inserted > 0) onSuccess(result.data_month)
    onClose()
  }

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>อัพโหลด Rejection Log</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!result ? (
            <>
              <div>
                <label style={labelStyle}>ไฟล์ข้อมูล (.xls / .xlsx / .txt)</label>
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragEnter={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '24px 16px',
                    textAlign: 'center', cursor: 'pointer',
                    background: dragging ? 'var(--primary-soft)' : 'var(--bg)',
                    transition: 'all .15s',
                  }}
                >
                  <Icon name="upload" size={20} />
                  <div style={{ marginTop: 8, fontSize: 13, color: dragging ? 'var(--primary)' : 'var(--ink)', fontWeight: 500 }}>
                    {dragging ? 'วางไฟล์ที่นี่' : file ? file.name : 'คลิกหรือลากวางไฟล์ที่นี่'}
                  </div>
                  {file && !dragging && (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                  {!file && !dragging && (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>.xls / .xlsx / .txt</div>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xls,.xlsx,.txt"
                  style={{ display: 'none' }}
                  onChange={e => pickFile(e.target.files?.[0])}
                />
              </div>

              <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--ink)' }}>Columns ที่ต้องการ:</strong><br />
                spcmdate, spcmtime, ln, dspname, hn, an, spcmnotedt, labspcmnm, itemno, name, cnclspcmdt, cnclstfnm, cncldatetime, name_1, dspname_2, hptnm
              </div>

              {uploadError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)' }}>
                  {uploadError}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11.5, color: '#16A34A', fontWeight: 600, marginBottom: 4 }}>เพิ่มใหม่</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#15803D' }}>{result.inserted.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#4ADE80' }}>records</div>
                </div>
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11.5, color: '#D97706', fontWeight: 600, marginBottom: 4 }}>ข้ามซ้ำ</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#B45309' }}>{result.skipped.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#FCD34D' }}>records</div>
                </div>
              </div>
              {result.skipped > 0 && (
                <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--muted)' }}>
                  {result.skipped_in_file > 0 && (
                    <span style={{ background: 'var(--surface-2)', borderRadius: 6, padding: '3px 8px' }}>
                      ซ้ำในไฟล์ {result.skipped_in_file.toLocaleString()}
                    </span>
                  )}
                  {result.skipped_in_db > 0 && (
                    <span style={{ background: 'var(--surface-2)', borderRadius: 6, padding: '3px 8px' }}>
                      มีในระบบแล้ว {result.skipped_in_db.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
                ทั้งหมด {result.total.toLocaleString()} rows ในไฟล์
                {result.data_month && (
                  <span style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 600 }}>
                    · ข้อมูลเดือน {result.data_month}
                  </span>
                )}
              </div>
              {result.errors.length > 0 && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 6 }}>ข้อผิดพลาด</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--danger)' }}>
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {!result ? (
            <>
              <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                icon="upload"
                disabled={!file || uploading}
              >
                {uploading ? 'กำลังอัพโหลด…' : 'อัพโหลด'}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={handleDone}>เสร็จสิ้น</Button>
          )}
        </div>
      </div>
    </div>
  )
}
