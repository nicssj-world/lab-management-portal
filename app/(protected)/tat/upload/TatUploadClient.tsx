'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { getThaiMonthLabel } from '@/lib/kpi-utils'

type Phase = 'idle' | 'parsing' | 'uploading' | 'done' | 'error'
type TabType = 'lab' | 'phleb'

interface UploadRecord {
  id: string
  type: TabType
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

async function readJsonResponse(res: Response) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 300) || `HTTP ${res.status}` }
  }
}

function detectYearMonthFromSpcm(rows: { spcm_at: string }[]): { year: number; month: number } | null {
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

function detectYearMonthFromRegister(rows: { register_at: string }[]): { year: number; month: number } | null {
  if (rows.length === 0) return null
  const counts = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(r.register_at)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [y, m] = best[0].split('-').map(Number)
  return { year: y, month: m }
}

// ── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ pct, color = 'var(--primary)' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: '0 auto 0 0',
        width: `${pct}%`, background: color,
        borderRadius: 3, transition: 'width .2s',
      }} />
    </div>
  )
}

// ── Upload Panel ──────────────────────────────────────────────────────────

interface UploadPanelProps {
  workerSrc: string
  initUrl: string
  chunkUrl: string
  detectYearMonth: (rows: Record<string, string>[]) => { year: number; month: number } | null
  fileLabel: string
  onDone: (ym: { year: number; month: number }, needsRejoin: boolean) => void
}

function UploadPanel({ workerSrc, initUrl, chunkUrl, detectYearMonth, fileLabel, onDone }: UploadPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [parseProgress, setParseProgress] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [chunkStatus, setChunkStatus] = useState({ current: 0, total: 0 })
  const [stats, setStats] = useState<{ total: number; invalid: number; skipped: number } | null>(null)
  const [detected, setDetected] = useState<{ year: number; month: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [warningMsg, setWarningMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const abortRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    abortRef.current = false
    setPhase('parsing')
    setParseProgress(0)
    setUploadProgress(0)
    setStats(null)
    setDetected(null)
    setErrorMsg('')
    setWarningMsg('')

    let rows: Record<string, string>[]
    try {
      const buffer = await file.arrayBuffer()
      rows = await new Promise<Record<string, string>[]>((resolve, reject) => {
        const worker = new Worker(workerSrc)
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

    const ym = detectYearMonth(rows)
    if (!ym) {
      setPhase('error')
      setErrorMsg('ไม่พบข้อมูลวันที่ในไฟล์ — ตรวจสอบ format ของไฟล์')
      return
    }
    setDetected(ym)
    setPhase('uploading')

    try {
      const initRes = await fetch(initUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: ym.year, month: ym.month, file_name: file.name, total_rows: rows.length }),
      })
      const initJson = await readJsonResponse(initRes)
      if (!initRes.ok) throw new Error(initJson.error ?? 'Init failed')
      const { upload_id } = initJson

      const totalChunks = Math.ceil(rows.length / CHUNK_SIZE)
      setChunkStatus({ current: 0, total: totalChunks })
      let needsRejoin = false

      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) break
        const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const chunkRes = await fetch(chunkUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upload_id, rows: chunk, chunk_index: i, is_last_chunk: i === totalChunks - 1 }),
        })
        const chunkJson = await readJsonResponse(chunkRes)
        if (!chunkRes.ok) {
          const detail = chunkJson.error ? `: ${chunkJson.error}` : ''
          throw new Error(`Chunk ${i + 1}/${totalChunks} failed (HTTP ${chunkRes.status})${detail}`)
        }
        if (chunkJson.skipped > 0) {
          setStats(s => s ? { ...s, skipped: s.skipped + chunkJson.skipped } : s)
        }
        if (chunkJson.needs_rejoin) needsRejoin = true
        setChunkStatus({ current: i + 1, total: totalChunks })
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100))
      }

      if (!abortRef.current) {
        setPhase('done')
        onDone(ym, needsRejoin)
      } else {
        setPhase('idle')
      }
    } catch (err) {
      setPhase('error')
      setErrorMsg((err as Error).message)
    }
  }

  function handleCancel() {
    abortRef.current = true
    workerRef.current?.terminate()
    workerRef.current = null
    setPhase('idle')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const isActive = phase !== 'idle'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !isActive && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary)' : isActive ? 'var(--border)' : 'var(--border)'}`,
          borderRadius: 14,
          padding: '36px 24px',
          textAlign: 'center',
          background: dragOver ? 'rgba(30,95,173,.05)' : 'var(--bg)',
          cursor: isActive ? 'default' : 'pointer',
          transition: 'all .2s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.tsv"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />

        {/* Upload icon with ring */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: dragOver ? 'rgba(30,95,173,.15)' : 'rgba(30,95,173,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          transition: 'all .2s',
          color: 'var(--primary)',
          border: dragOver ? '2px solid var(--primary)' : '2px solid rgba(30,95,173,.2)',
        }}>
          <Icon name="upload" size={24} />
        </div>

        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14, marginBottom: 6 }}>
          {isActive ? 'กำลังประมวลผล...' : `ลากไฟล์ ${fileLabel} มาวาง`}
        </div>
        {!isActive && (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              หรือ{' '}
              <span style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                คลิกเพื่อเลือกไฟล์
              </span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--muted)',
            }}>
              <Icon name="doc" size={12} />
              รองรับ .txt และ .tsv (UTF-16LE จาก HIS/LIS)
            </div>
          </>
        )}
      </div>

      {/* Parsing progress */}
      {phase === 'parsing' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(30,95,173,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Icon name="doc" size={14} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>กำลัง parse ข้อมูล...</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{parseProgress}%</span>
          </div>
          <ProgressBar pct={parseProgress} />
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={handleCancel}>ยกเลิก</Button>
          </div>
        </div>
      )}

      {/* Uploading progress */}
      {phase === 'uploading' && detected && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(22,163,74,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <Icon name="upload" size={14} />
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  บันทึกเดือน {getThaiMonthLabel(detected.month)} {detected.year + 543}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                  {stats?.total.toLocaleString()} แถว • chunk {chunkStatus.current}/{chunkStatus.total}
                </span>
              </div>
              {warningMsg && (
                <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4, fontWeight: 600 }}>
                  {warningMsg}
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{uploadProgress}%</span>
          </div>
          <ProgressBar pct={uploadProgress} color="var(--success)" />
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={handleCancel}>ยกเลิก</Button>
          </div>
        </div>
      )}

      {/* Success */}
      {phase === 'done' && stats && detected && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(22,163,74,.07)', border: '1px solid rgba(22,163,74,.25)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(22,163,74,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', flexShrink: 0 }}>
              <Icon name="check" size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 13 }}>อัพโหลดสำเร็จ</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {getThaiMonthLabel(detected.month)} {detected.year + 543}
                {' · '}บันทึก <strong style={{ color: 'var(--ink)' }}>{(stats.total - stats.invalid - stats.skipped).toLocaleString()}</strong> แถว
                {' · '}ไม่ถูกต้อง <strong style={{ color: 'var(--ink)' }}>{stats.invalid}</strong> แถว
                {stats.skipped > 0 && <>{' · '}ข้ามซ้ำ <strong style={{ color: 'var(--ink)' }}>{stats.skipped.toLocaleString()}</strong> แถว</>}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setPhase('idle'); setDetected(null) }}>อัพโหลดเพิ่ม</Button>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(220,38,38,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', flexShrink: 0 }}>
              <Icon name="alert" size={16} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
              {errorMsg || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPhase('idle')}>ลองใหม่</Button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

export function TatUploadClient() {
  const [activeTab, setActiveTab] = useState<TabType>('lab')
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [rejoining, setRejoining] = useState<string | null>(null)
  const [rejoinProgress, setRejoinProgress] = useState<Record<string, number>>({})
  const [rejoinedMonths, setRejoinedMonths] = useState<Set<string>>(new Set())
  const { toasts, add: addToast } = useToast()

  const loadHistory = useCallback(async () => {
    try {
      const [tatRes, phlebRes] = await Promise.all([
        fetch('/api/admin/tat/uploads'),
        fetch('/api/admin/phleb/uploads'),
      ])
      const tatData = tatRes.ok ? await tatRes.json() : { uploads: [] }
      const phlebData = phlebRes.ok ? await phlebRes.json() : { uploads: [] }

      const tatRecords: UploadRecord[] = (tatData.uploads ?? []).map((u: Omit<UploadRecord, 'type'>) => ({ ...u, type: 'lab' as const }))
      const phlebRecords: UploadRecord[] = (phlebData.uploads ?? []).map((u: Omit<UploadRecord, 'type'>) => ({ ...u, type: 'phleb' as const }))

      const merged = [...tatRecords, ...phlebRecords].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year
        if (b.month !== a.month) return b.month - a.month
        return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      })
      setUploads(merged)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleDone(ym: { year: number; month: number }, needsRejoin: boolean, type: TabType) {
    addToast(`บันทึกไฟล์${type === 'lab' ? 'ผลตรวจ' : 'การเจาะเลือด'} เดือน ${getThaiMonthLabel(ym.month)} ${ym.year + 543} สำเร็จ`)
    loadHistory()
    if (needsRejoin) {
      addToast(`กำลังเชื่อมข้อมูลเดือน ${getThaiMonthLabel(ym.month)}...`)
      await handleRejoin(ym.year, ym.month)
    }
  }

  async function handleDelete(id: string, type: TabType) {
    setDeleting(id)
    try {
      const url = type === 'lab' ? `/api/admin/tat/upload/${id}` : `/api/admin/phleb/upload/${id}`
      const res = await fetch(url, { method: 'DELETE' })
      const json = await readJsonResponse(res)
      if (!res.ok) throw new Error(json.error ?? `Delete failed (HTTP ${res.status})`)
      addToast('ลบข้อมูลสำเร็จ')
      loadHistory()
    } catch (err) {
      addToast((err as Error).message, false)
    } finally {
      setDeleting(null)
    }
  }

  async function handleRejoin(year: number, month: number) {
    const key = `${year}-${month}`
    setRejoining(key)
    setRejoinProgress(prev => ({ ...prev, [key]: 0 }))
    try {
      let cursor: string | null = null
      let processed = 0
      for (let step = 0; step < 10000; step++) {
        const res = await fetch('/api/admin/tat/rejoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, month, cursor }),
        })
        const json = await readJsonResponse(res) as {
          error?: string
          done?: boolean
          nextCursor?: string | null
          processed?: number
          warning?: string | null
        }
        if (!res.ok) throw new Error(json.error ?? `Rejoin failed (HTTP ${res.status})`)
        processed += json.processed ?? 0
        setRejoinProgress(prev => ({ ...prev, [key]: processed }))
        cursor = json.nextCursor ?? null
        if (json.done) {
          if (json.warning) addToast(`Rejoin สำเร็จ แต่มี warning: ${json.warning}`, false)
          break
        }
        if (!cursor) throw new Error('Rejoin stopped without cursor')
      }
      setRejoinedMonths(prev => new Set(prev).add(key))
      addToast(`เชื่อมข้อมูลเดือน ${getThaiMonthLabel(month)} ${year + 543} สำเร็จ`)
    } catch (err) {
      addToast((err as Error).message, false)
    } finally {
      setRejoining(null)
      setRejoinProgress(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,.2)', maxWidth: 320,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name={t.ok ? 'check' : 'alert'} size={14} />
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/tat"><Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button></Link>
        <PageHeader
          eyebrow="TAT"
          title="อัพโหลดข้อมูล"
          subtitle="นำเข้าไฟล์จาก HIS/LIS (UTF-16LE TSV) — ระบบ detect ปี/เดือนจากไฟล์อัตโนมัติ"
          marginBottom={0}
        />
      </div>

      {/* Tab selector */}
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', padding: 3, borderRadius: 28, gap: 2, alignSelf: 'flex-start' }}>
        {([
          { id: 'lab' as TabType,  label: 'ไฟล์ผลตรวจ Lab (TAT)', icon: 'beaker'  },
          { id: 'phleb' as TabType, label: 'ไฟล์การเจาะเลือด',      icon: 'syringe' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px', borderRadius: 24, border: 'none',
              background: activeTab === tab.id ? 'var(--card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .2s',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,.10)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name={tab.icon} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upload card */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {activeTab === 'phleb' && (
          <div style={{
            padding: '11px 18px', borderBottom: '1px solid var(--border)',
            background: 'rgba(217,119,6,.04)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
            borderLeft: '3px solid var(--warning)',
          }}>
            <span style={{ color: 'var(--warning)', marginTop: 1 }}><Icon name="alert" size={14} /></span>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink)' }}>หมายเหตุ:</strong>
              {' '}เดือนที่ต้องการข้อมูล Phlebotomy ต้อง re-upload ไฟล์ผลตรวจ Lab (TAT) ด้วย
              เพื่อให้ column hn ถูกบันทึก — ไฟล์ที่อัพโหลดก่อนหน้าจะ join ไม่ได้
            </div>
          </div>
        )}
        <div style={{ padding: 24 }}>
          {activeTab === 'lab' && (
            <UploadPanel
              workerSrc="/workers/tat-parser.worker.js?v=3"
              initUrl="/api/admin/tat/upload/init"
              chunkUrl="/api/admin/tat/upload/chunk"
              detectYearMonth={(rows) => detectYearMonthFromSpcm(rows as { spcm_at: string }[])}
              fileLabel="ผลตรวจ Lab"
              onDone={(ym, needsRejoin) => handleDone(ym, needsRejoin, 'lab')}
            />
          )}
          {activeTab === 'phleb' && (
            <UploadPanel
              workerSrc="/workers/phleb-parser.worker.js?v=4"
              initUrl="/api/admin/phleb/upload/init"
              chunkUrl="/api/admin/phleb/upload/chunk"
              detectYearMonth={(rows) => detectYearMonthFromRegister(rows as { register_at: string }[])}
              fileLabel="การเจาะเลือด"
              onDone={(ym, needsRejoin) => handleDone(ym, needsRejoin, 'phleb')}
            />
          )}
        </div>
      </div>

      {/* Upload history */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          padding: '13px 20px', borderBottom: '1px solid var(--border)',
          borderLeft: '3px solid var(--primary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="clock" size={14} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>ประวัติการอัพโหลด</span>
          {uploads.length > 0 && (
            <span style={{
              marginLeft: 4, fontSize: 11, fontWeight: 700, color: 'var(--muted)',
              background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 10,
            }}>
              {uploads.length}
            </span>
          )}
        </div>

        {uploads.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            ยังไม่มีข้อมูลที่อัพโหลด
          </div>
        ) : (() => {
          const monthTypes = new Map<string, Set<TabType>>()
          for (const u of uploads) {
            const key = `${u.year}-${u.month}`
            if (!monthTypes.has(key)) monthTypes.set(key, new Set())
            monthTypes.get(key)!.add(u.type)
          }
          const canRejoin = (year: number, month: number) => {
            const s = monthTypes.get(`${year}-${month}`)
            return s?.has('lab') && s?.has('phleb')
          }

          return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['ประเภท', 'เดือน', 'ไฟล์', 'จำนวนแถว', 'อัพโหลดโดย', 'วันที่', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, color: 'var(--muted)',
                      letterSpacing: '.05em', textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploads.map(u => (
                  <tr
                    key={`${u.type}-${u.id}`}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <Badge color={u.type === 'lab' ? 'blue' : 'purple'} dot>
                        {u.type === 'lab' ? 'Lab TAT' : 'Phlebotomy'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                      {getThaiMonthLabel(u.month)} {u.year + 543}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.file_name}
                    </td>
                    <td style={{ padding: '10px 16px' }}>{u.row_count.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{u.uploader_name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>
                      {new Date(u.uploaded_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {u.type === 'lab' && canRejoin(u.year, u.month) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="check"
                            disabled={rejoining === `${u.year}-${u.month}`}
                            style={rejoinedMonths.has(`${u.year}-${u.month}`) ? {
                              background: 'var(--success)',
                              borderColor: 'var(--success)',
                              color: '#fff',
                            } : undefined}
                            onClick={() => handleRejoin(u.year, u.month)}
                          >
                            {rejoining === `${u.year}-${u.month}` ? 'กำลังเชื่อม...' : 'Rejoin'}
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          icon="trash"
                          disabled={deleting === u.id}
                          onClick={() => handleDelete(u.id, u.type)}
                        >
                          {deleting === u.id ? 'กำลังลบ...' : 'ลบ'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </div>
    </div>
  )
}
