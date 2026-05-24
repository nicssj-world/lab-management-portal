'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { getThaiMonthLabel } from '@/lib/kpi-utils'

type Phase = 'idle' | 'parsing' | 'uploading' | 'done' | 'error'

interface UploadRecord {
  id: string
  year: number
  month: number
  file_name: string
  row_count: number
  uploaded_at: string
  uploader_name: string
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts(t => [...t, { id, msg, ok }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

const CHUNK_SIZE = 1000

// หา year-month ที่พบมากที่สุดจาก spcm_at timestamps
function detectYearMonth(rows: { spcm_at: string }[]): { year: number; month: number } | null {
  if (rows.length === 0) return null
  const counts = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(r.spcm_at)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [y, m] = best[0].split('-').map(Number)
  return { year: y, month: m }
}

export function TatUploadClient() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [parseProgress, setParseProgress] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [chunkStatus, setChunkStatus] = useState({ current: 0, total: 0 })
  const [stats, setStats] = useState<{ total: number; invalid: number; skipped: number } | null>(null)
  const [detected, setDetected] = useState<{ year: number; month: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const abortRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toasts, add: addToast } = useToast()

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tat/uploads')
      if (res.ok) {
        const j = await res.json()
        setUploads(j.uploads ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleFile(file: File) {
    abortRef.current = false
    setPhase('parsing')
    setParseProgress(0)
    setUploadProgress(0)
    setStats(null)
    setDetected(null)
    setErrorMsg('')

    let rows: { spcm_at: string }[]
    try {
      const buffer = await file.arrayBuffer()

      rows = await new Promise<{ spcm_at: string }[]>((resolve, reject) => {
        const worker = new Worker('/workers/tat-parser.worker.js')
        workerRef.current = worker
        worker.onmessage = (e) => {
          if (e.data.type === 'progress') {
            setParseProgress(Math.round((e.data.parsed / Math.max(e.data.total, 1)) * 100))
          } else if (e.data.type === 'done') {
            setStats({ total: e.data.rows.length, invalid: e.data.invalid, skipped: 0 })
            worker.terminate()
            resolve(e.data.rows)
          } else if (e.data.type === 'error') {
            worker.terminate()
            reject(new Error(e.data.message))
          }
        }
        worker.onerror = (err) => { worker.terminate(); reject(new Error(err.message)) }
        worker.postMessage({ buffer }, [buffer])
      })
    } catch (err) {
      setPhase('error')
      setErrorMsg((err as Error).message)
      return
    }

    if (abortRef.current) { setPhase('idle'); return }

    // Detect year/month from data
    const ym = detectYearMonth(rows)
    if (!ym) {
      setPhase('error')
      setErrorMsg('ไม่พบข้อมูลวันที่ในไฟล์ — ตรวจสอบ format ของไฟล์')
      return
    }
    setDetected(ym)

    setPhase('uploading')

    try {
      const initRes = await fetch('/api/admin/tat/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: ym.year, month: ym.month, file_name: file.name, total_rows: rows.length }),
      })
      if (!initRes.ok) throw new Error((await initRes.json()).error ?? 'Init failed')
      const { upload_id } = await initRes.json()

      const totalChunks = Math.ceil(rows.length / CHUNK_SIZE)
      setChunkStatus({ current: 0, total: totalChunks })

      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) break
        const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const chunkRes = await fetch('/api/admin/tat/upload/chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_id,
            rows: chunk,
            chunk_index: i,
            is_last_chunk: i === totalChunks - 1,
          }),
        })
        const chunkJson = await chunkRes.json()
        if (!chunkRes.ok) throw new Error(chunkJson.error ?? `Chunk ${i} failed`)
        if (chunkJson.skipped > 0) {
          setStats(s => s ? { ...s, skipped: s.skipped + chunkJson.skipped } : s)
        }
        setChunkStatus({ current: i + 1, total: totalChunks })
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100))
      }

      if (!abortRef.current) {
        setPhase('done')
        addToast(`บันทึก ${rows.length.toLocaleString()} แถว เดือน ${getThaiMonthLabel(ym.month)} ${ym.year + 543} สำเร็จ`)
        loadHistory()
      } else {
        setPhase('idle')
      }
    } catch (err) {
      setPhase('error')
      setErrorMsg((err as Error).message)
      addToast((err as Error).message, false)
    }
  }

  function handleCancel() {
    abortRef.current = true
    workerRef.current?.terminate()
    workerRef.current = null
    setPhase('idle')
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/tat/upload/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed')
      addToast('ลบข้อมูลสำเร็จ')
      loadHistory()
    } catch (err) {
      addToast((err as Error).message, false)
    } finally {
      setDeleting(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)', maxWidth: 320,
          }}>
            {t.msg}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/tat"><Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button></Link>
        <PageHeader eyebrow="TAT" title="อัพโหลดข้อมูล TAT" subtitle="นำเข้าไฟล์จาก HIS หรือ LIS (UTF-16LE TSV) — ระบบ detect ปี/เดือนจากไฟล์อัตโนมัติ" marginBottom={0} />
      </div>

      <Card padding={24}>
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => phase === 'idle' && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            background: dragOver ? 'var(--primary-soft)' : 'var(--bg)',
            cursor: phase === 'idle' ? 'pointer' : 'default',
            transition: 'all .15s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.tsv"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <div style={{ color: 'var(--primary)', marginBottom: 10 }}>
            <Icon name="upload" size={36} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            {phase === 'idle' ? 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์' : 'กำลังประมวลผล...'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>รองรับไฟล์ .txt และ .tsv (UTF-16LE จาก LIS)</div>
        </div>

        {/* Parsing progress */}
        {phase === 'parsing' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>กำลัง parse ข้อมูล...</span>
              <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{parseProgress}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${parseProgress}%`, background: 'var(--primary)', borderRadius: 4, transition: 'width .2s' }} />
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button variant="secondary" size="sm" onClick={handleCancel}>ยกเลิก</Button>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {phase === 'uploading' && detected && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                บันทึกเดือน <strong>{getThaiMonthLabel(detected.month)} {detected.year + 543}</strong>
                {' '}— {stats?.total.toLocaleString()} แถว  •  chunk {chunkStatus.current}/{chunkStatus.total}
              </span>
              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{uploadProgress}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${uploadProgress}%`, background: 'var(--success)', borderRadius: 4, transition: 'width .2s' }} />
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button variant="secondary" size="sm" onClick={handleCancel}>ยกเลิก</Button>
            </div>
          </div>
        )}

        {/* Done summary */}
        {phase === 'done' && stats && detected && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>✓ อัพโหลดสำเร็จ</div>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                เดือน <strong>{getThaiMonthLabel(detected.month)} {detected.year + 543}</strong>
                {'  •  '}บันทึก <strong>{(stats.total - stats.invalid - stats.skipped).toLocaleString()}</strong> แถว
                {'  •  '}ข้ามข้อมูลไม่ถูกต้อง <strong>{stats.invalid}</strong> แถว
                {stats.skipped > 0 && <>{'  •  '}ข้ามซ้ำ <strong>{stats.skipped.toLocaleString()}</strong> แถว</>}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setPhase('idle'); setDetected(null) }}>อัพโหลดเพิ่ม</Button>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--danger)' }}>⚠ {errorMsg || 'เกิดข้อผิดพลาด'}</div>
            <Button variant="ghost" size="sm" onClick={() => setPhase('idle')}>ลองใหม่</Button>
          </div>
        )}
      </Card>

      {/* Upload history */}
      <Card padding={0}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          ประวัติการอัพโหลด
        </div>
        {uploads.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            ยังไม่มีข้อมูลที่อัพโหลด
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['เดือน', 'ไฟล์', 'จำนวนแถว', 'อัพโหลดโดย', 'วันที่', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploads.map(u => (
                <tr
                  key={u.id}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                    {getThaiMonthLabel(u.month)} {u.year + 543}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.file_name}
                  </td>
                  <td style={{ padding: '10px 16px' }}>{u.row_count.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{u.uploader_name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>
                    {new Date(u.uploaded_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="trash"
                      disabled={deleting === u.id}
                      onClick={() => handleDelete(u.id)}
                    >
                      {deleting === u.id ? 'กำลังลบ...' : 'ลบ'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
