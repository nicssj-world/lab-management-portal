'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadFileWithProgress } from '@/lib/documents/upload-with-progress'
import { safetyExpiryLabel } from '@/lib/lab-map/safety-domain'
import { nextSafetyInspectionDate, SAFETY_INSPECTION_SCHEDULE_LABEL } from '@/lib/lab-map/safety-inspection-schedule'
import { checklistForSafetyKind, validateChecklistCompletion } from '@/lib/lab-map/safety-inspection-checklists'
import {
  deleteSafetyInspectionDraft,
  loadSafetyInspectionDraft,
  safetyInspectionDraftKey,
  saveSafetyInspectionDraft,
  type StoredSafetyInspectionDraft,
} from '@/lib/lab-map/safety-inspection-drafts'
import type {
  SafetyAssetDTO,
  SafetyChecklistAnswer,
  SafetyInspectionQueue,
} from '@/lib/lab-map/types'
import { SafetyInspectionChecklist } from './SafetyInspectionChecklist'
import { SafetyInspectionProgress } from './SafetyInspectionProgress'
import { SafetyPhotoPicker } from './SafetyPhotoPicker'
import { SafetyAssetStatusBadges } from './SafetyAssetStatusBadges'
import { SafetyPositionVerification } from './SafetyPositionVerification'

type SubmissionPhase = 'idle' | 'compressing' | 'signing' | 'uploading' | 'finalizing' | 'success' | 'error'
type InspectionResult = 'passed' | 'needs_attention' | 'failed' | 'not_found'

export interface SafetyInspectionDraft {
  result: InspectionResult
  note: string
  expiresOn: string
  checklist: SafetyChecklistAnswer[]
  file: File | null
}

export interface SafetyInspectionResultCounts {
  passed: number
  needsAttention: number
  failed: number
  notFound: number
}

const RESULT_OPTIONS: ReadonlyArray<{ value: InspectionResult; label: string }> = [
  { value: 'passed', label: 'ผ่าน' },
  { value: 'needs_attention', label: 'ต้องติดตาม' },
  { value: 'failed', label: 'ไม่พร้อมใช้' },
  { value: 'not_found', label: 'ไม่พบอุปกรณ์' },
]

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? 'ดำเนินการไม่สำเร็จ')
  return json
}

export function SafetyInspectionMobile({ item, locationLabel, queue, roundName, roundItemId, canEdit,
  roundId, resultCounts, onBack, onPrevious, onShowMap, onSaved, onPositionVerified, onCloseRound }: {
  item: SafetyAssetDTO
  locationLabel: string
  queue: SafetyInspectionQueue
  roundName?: string | null
  roundItemId?: string | null
  roundId?: string | null
  resultCounts: SafetyInspectionResultCounts
  canEdit: boolean
  onBack: () => void
  onPrevious: () => void
  onShowMap: () => void
  onSaved: (mode: 'stay' | 'next', result: InspectionResult) => Promise<void>
  onPositionVerified: () => Promise<void>
  onCloseRound: () => Promise<void> | void
}) {
  const template = useMemo(() => checklistForSafetyKind(item.kind), [item.kind])
  const [result, setResult] = useState<InspectionResult>('passed')
  const [note, setNote] = useState('')
  const nextInspectionDate = nextSafetyInspectionDate(todayIso())
  const [expiresOn, setExpiresOn] = useState(item.latestInspection?.expiresOn ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [checklist, setChecklist] = useState<SafetyChecklistAnswer[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [phase, setPhase] = useState<SubmissionPhase>('idle')
  const [correctingExpiry, setCorrectingExpiry] = useState(false)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [storedDraft, setStoredDraft] = useState<StoredSafetyInspectionDraft | null>(null)
  const submissionLockRef = useRef(false)

  const busy = ['signing', 'uploading', 'finalizing'].includes(phase)
  const currentExpiresOn = item.latestInspection?.expiresOn ?? ''
  const roundComplete = Boolean(roundName && queue.progress.total > 0 && queue.progress.remaining === 0)
  const draftKey = useMemo(() => safetyInspectionDraftKey(roundId, item.id), [item.id, roundId])

  useEffect(() => {
    let active = true
    void loadSafetyInspectionDraft(draftKey)
      .then(value => { if (active) setStoredDraft(value) })
      .catch(() => { if (active) setStoredDraft(null) })
    return () => { active = false }
  }, [draftKey])

  useEffect(() => {
    const becameOnline = () => {
      setOnline(true)
      setMessage('กลับมาออนไลน์แล้ว — แตะยืนยันเพื่อส่ง')
    }
    const becameOffline = () => setOnline(false)
    window.addEventListener('online', becameOnline)
    window.addEventListener('offline', becameOffline)
    return () => {
      window.removeEventListener('online', becameOnline)
      window.removeEventListener('offline', becameOffline)
    }
  }, [])

  async function persistDraft(showMessage: boolean) {
    await saveSafetyInspectionDraft({
      key: draftKey,
      result,
      note,
      nextInspectionDate,
      expiresOn,
      checklist,
      compressedPhoto: file ? { blob: file, name: file.name, type: file.type } : null,
      savedAt: new Date().toISOString(),
    })
    if (showMessage) {
      setPhase('idle')
      setMessage('บันทึกร่างในเครื่องแล้ว')
    }
  }

  useEffect(() => {
    const hasContent = Boolean(note || expiresOn || checklist.length || file)
    if (!hasContent || storedDraft) return
    const timer = setTimeout(() => { void persistDraft(false) }, 500)
    return () => clearTimeout(timer)
  }, [checklist, expiresOn, file, note, storedDraft])

  function restoreStoredDraft() {
    if (!storedDraft) return
    setResult(storedDraft.result)
    setNote(storedDraft.note)
    setExpiresOn(storedDraft.expiresOn)
    setChecklist(storedDraft.checklist)
    setFile(storedDraft.compressedPhoto
      ? new File([storedDraft.compressedPhoto.blob], storedDraft.compressedPhoto.name, { type: storedDraft.compressedPhoto.type })
      : null)
    setStoredDraft(null)
    setMessage('ใช้แบบร่างที่บันทึกไว้แล้ว')
  }

  async function submitInspection(mode: 'stay' | 'next') {
    setShowErrors(true)
    const completion = validateChecklistCompletion(template, checklist)
    if (!completion.valid) {
      setPhase('error')
      setMessage('กรุณาตรวจให้ครบทุกหัวข้อ')
      return
    }
    if (!file) {
      setPhase('error')
      setMessage('กรุณาถ่ายหรือเลือกรูปหลักฐาน')
      return
    }
    if (submissionLockRef.current) return
    submissionLockRef.current = true
    setMessage('')
    setUploadPercent(0)
    try {
      const inspectedOn = todayIso()
      setPhase('signing')
      const signed = await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-photo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      })
      setPhase('uploading')
      await uploadFileWithProgress(signed.uploadUrl, file, file.type, setUploadPercent)
      setPhase('finalizing')
      const saved = await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-photo`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: signed.key, fileName: file.name, result, inspectedOn,
          expiresOn: expiresOn || null,
          note: note || null, roundItemId: roundItemId ?? null, checklist,
        }),
      })
      setPhase('success')
      setMessage(saved.reused ? 'มีผลตรวจวันนี้แล้ว ระบบใช้รูปเดิมให้แล้ว' : 'บันทึกผลตรวจแล้ว')
      await deleteSafetyInspectionDraft(draftKey)
      await onSaved(mode, result)
      if (mode === 'stay') {
        setFile(null)
        setChecklist([])
        setNote('')
      }
    } catch (error) {
      setPhase('error')
      setMessage((error as Error).message)
    } finally {
      submissionLockRef.current = false
    }
  }

  async function correctExpiry() {
    if (!item.latestInspection || expiresOn === currentExpiresOn) return
    setCorrectingExpiry(true)
    setMessage('')
    try {
      await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-expiry`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: item.latestInspection.id, expiresOn: expiresOn || null, updatedAt: item.updatedAt }),
      })
      setMessage('แก้ไขกำหนดวันเรียบร้อยแล้ว')
      await onPositionVerified()
    } catch (error) {
      setPhase('idle')
      setMessage((error as Error).message)
    } finally {
      setCorrectingExpiry(false)
    }
  }

  return <section className="safety-inspection-mobile" aria-label={`ตรวจ ${item.nameTh}`}>
    <header className="safety-inspection-mobile-head">
      <button type="button" onClick={onBack}>กลับไปรายการ</button>
      <button type="button" onClick={onShowMap}>ดูบนแผนที่</button>
    </header>
    <SafetyInspectionProgress queue={queue} roundName={roundName} />
    {storedDraft ? <aside className="safety-draft-recovery" role="status">
      <strong>พบแบบตรวจที่บันทึกไว้ในเครื่อง</strong>
      <small>บันทึกล่าสุด {new Date(storedDraft.savedAt).toLocaleString('th-TH')}</small>
      <div>
        <button type="button" onClick={restoreStoredDraft}>ใช้แบบร่าง</button>
        <button type="button" onClick={() => void deleteSafetyInspectionDraft(draftKey).then(() => setStoredDraft(null))}>เริ่มใหม่</button>
      </div>
    </aside> : null}
    <div className="safety-inspection-identity">
      <span><h2>{item.nameTh}</h2><small>{item.code} · {locationLabel}</small></span>
      <SafetyAssetStatusBadges item={item} />
    </div>
    <SafetyPositionVerification item={item} disabled={busy} onVerified={onPositionVerified} />
    {roundComplete ? <section className="safety-round-summary" aria-label="สรุปรอบตรวจ">
      <h3>สรุปรอบตรวจ</h3>
      <dl>
        <div><dt>ผ่าน</dt><dd>{resultCounts.passed}</dd></div>
        <div><dt>ต้องติดตาม</dt><dd>{resultCounts.needsAttention}</dd></div>
        <div><dt>ไม่พร้อมใช้</dt><dd>{resultCounts.failed}</dd></div>
        <div><dt>ไม่พบอุปกรณ์</dt><dd>{resultCounts.notFound}</dd></div>
      </dl>
      <button type="button" onClick={() => void onCloseRound()}>ปิดรอบตรวจ</button>
    </section> : canEdit ? <div className="safety-inspection-fields">
      <label>ผลตรวจ
        <select value={result} disabled={busy} onChange={event => setResult(event.target.value as InspectionResult)}>
          {RESULT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <SafetyInspectionChecklist template={template} answers={checklist} showErrors={showErrors} disabled={busy} onChange={setChecklist} />
      <SafetyPhotoPicker label="รูปหลักฐาน" file={file} disabled={busy} uploadPercent={phase === 'uploading' ? uploadPercent : null} onChange={setFile} />
      <div className="safety-form-grid">
        <label>{SAFETY_INSPECTION_SCHEDULE_LABEL}<input type="date" value={nextInspectionDate} readOnly disabled /></label>
        <label>{safetyExpiryLabel(item.kind)}<input type="date" value={expiresOn} disabled={busy || correctingExpiry} onChange={event => setExpiresOn(event.target.value)} /></label>
      </div>
      <label>หมายเหตุ<textarea value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
    </div> : null}
    <p className={`safety-submit-status safety-submit-status-${phase}`} role={phase === 'error' ? 'alert' : 'status'} aria-live="polite">
      {phase === 'signing' ? 'กำลังเตรียมพื้นที่อัปโหลด…'
        : phase === 'uploading' ? `กำลังอัปโหลด ${uploadPercent ?? 0}%…`
          : phase === 'finalizing' ? 'กำลังบันทึกผลตรวจ…' : message}
    </p>
    {canEdit && !roundComplete ? <footer className="safety-inspection-actions">
      <button type="button" disabled={busy || correctingExpiry} onClick={onPrevious}>เครื่องก่อนหน้า</button>
      <button type="button" disabled={busy || correctingExpiry} onClick={() => void persistDraft(true)}>บันทึกร่างในเครื่อง</button>
      <div className="safety-inspection-primary-actions">
        <button type="button" disabled={busy || correctingExpiry || !item.latestInspection || expiresOn === currentExpiresOn} onClick={() => void correctExpiry()}>บันทึกการแก้ไข</button>
        <button type="button" disabled={busy || correctingExpiry || !online} onClick={() => void submitInspection('next')}>
          {!online ? 'รอเชื่อมต่อเพื่อส่งผลตรวจ' : phase === 'error' ? 'ลองอัปโหลดอีกครั้ง' : 'ยืนยันและไปเครื่องถัดไป'}
        </button>
      </div>
    </footer> : null}
  </section>
}
