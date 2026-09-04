'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileDropzone } from '@/components/ui/FileDropzone'
import type { ItBackupAttachment, ItBackupLogWithRefs, ItSystem } from '@/lib/supabase/types'

type PickProfile = { id: string; name: string }

interface Props {
  initialLogs: ItBackupLogWithRefs[]
  systems: ItSystem[]
  profiles: PickProfile[]
  canEdit: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }
const thStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'left' }
const tdStyle: React.CSSProperties = { padding: '9px 12px', color: 'var(--ink)', verticalAlign: 'middle' }
const iconBtn: React.CSSProperties = {
  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
  width: 30, height: 30, borderRadius: 7, cursor: 'pointer', marginLeft: 6,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

const ACTIVITY_LABEL: Record<string, string> = { backup: 'สำรองข้อมูล', restore_test: 'ทดสอบกู้คืน' }
const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx'
const MAX_NEW_ATTACHMENTS = 5
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const ATTACHMENT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'xls', 'xlsx'])
const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function fileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function fileContentType(file: File) {
  return ATTACHMENT_MIME_BY_EXTENSION[fileExtension(file.name)] || file.type || 'application/octet-stream'
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function attachmentIcon(contentType: string) {
  return contentType.startsWith('image/') ? 'eye' : 'doc'
}

type Form = { id?: string; system_id: string; log_date: string; activity: 'backup' | 'restore_test'; result: 'success' | 'failed'; performed_by: string; note: string }
function emptyForm(): Form {
  const today = new Date().toLocaleDateString('en-CA')
  return { system_id: '', log_date: today, activity: 'backup', result: 'success', performed_by: '', note: '' }
}

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

export function ItBackupClient({ initialLogs, systems, profiles, canEdit }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [systemFilter, setSystemFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState<'all' | 'backup' | 'restore_test'>('all')
  const { toasts, add } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<ItBackupAttachment[]>([])
  const [attachmentActionId, setAttachmentActionId] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  const activeSystems = systems.filter((s) => s.is_active)

  const filtered = useMemo(() => logs.filter((l) => {
    if (systemFilter && l.system_id !== systemFilter) return false
    if (activityFilter !== 'all' && l.activity !== activityFilter) return false
    return true
  }), [logs, systemFilter, activityFilter])

  async function refetch() {
    const res = await fetch('/api/admin/it-backup')
    if (res.ok) {
      const j = await res.json()
      const nextLogs = (j.items ?? []) as ItBackupLogWithRefs[]
      setLogs(nextLogs)
      return nextLogs
    }
    return null
  }

  function clearAttachmentState() {
    setSelectedFiles([])
    setExistingAttachments([])
    setAttachmentError('')
    setUploadStatus('')
  }

  function openAdd() {
    setForm(emptyForm())
    clearAttachmentState()
    setFormOpen(true)
  }

  function openEdit(l: ItBackupLogWithRefs) {
    setForm({ id: l.id, system_id: l.system_id, log_date: l.log_date, activity: l.activity, result: l.result, performed_by: l.performed_by ?? '', note: l.note ?? '' })
    setSelectedFiles([])
    setExistingAttachments(l.attachments ?? [])
    setAttachmentError('')
    setUploadStatus('')
    setFormOpen(true)
  }

  function closeForm() {
    if (saving || attachmentActionId) return
    setFormOpen(false)
    clearAttachmentState()
  }

  function handleFiles(files: File[]) {
    setAttachmentError('')
    const supported = files.filter((file) => ATTACHMENT_EXTENSIONS.has(fileExtension(file.name)) && file.size <= MAX_ATTACHMENT_BYTES)
    if (supported.length !== files.length) {
      const hasOversize = files.some((file) => file.size > MAX_ATTACHMENT_BYTES)
      setAttachmentError(hasOversize ? 'ไฟล์หลักฐานต้องมีขนาดไม่เกิน 20 MB' : 'รองรับเฉพาะไฟล์ PDF, JPG, PNG, WEBP, XLS และ XLSX')
    }
    const remaining = Math.max(0, MAX_NEW_ATTACHMENTS - selectedFiles.length)
    if (supported.length > remaining) setAttachmentError(`แนบไฟล์ใหม่ได้ไม่เกิน ${MAX_NEW_ATTACHMENTS} ไฟล์ต่อครั้ง`)
    setSelectedFiles((current) => [...current, ...supported.slice(0, Math.max(0, MAX_NEW_ATTACHMENTS - current.length))])
  }

  async function uploadAttachment(logId: string, file: File) {
    const metadata = {
      logId,
      fileName: file.name,
      contentType: fileContentType(file),
      sizeBytes: file.size,
    }
    const presignRes = await fetch('/api/admin/it-backup/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })
    const presign = await presignRes.json().catch(() => ({}))
    if (!presignRes.ok) throw new Error(presign.error ?? 'ขอสิทธิ์อัปโหลดไฟล์ไม่สำเร็จ')

    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': metadata.contentType },
      body: file,
    })
    if (!put.ok) throw new Error('อัปโหลดไฟล์ไปยังที่จัดเก็บไม่สำเร็จ')

    const finalizeRes = await fetch('/api/admin/it-backup/attachments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId, key: presign.key, fileName: file.name }),
    })
    const finalized = await finalizeRes.json().catch(() => ({}))
    if (!finalizeRes.ok) throw new Error(finalized.error ?? 'บันทึกไฟล์หลักฐานไม่สำเร็จ')
  }

  async function removeExistingAttachment(attachment: ItBackupAttachment) {
    if (!window.confirm(`ลบไฟล์ ${attachment.file_name} หรือไม่`)) return
    setAttachmentActionId(attachment.id)
    setAttachmentError('')
    try {
      const res = await fetch(`/api/admin/it-backup/attachments/${attachment.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'ลบไฟล์หลักฐานไม่สำเร็จ')
      setExistingAttachments((current) => current.filter((file) => file.id !== attachment.id))
      setLogs((current) => current.map((log) => log.id === attachment.backup_log_id
        ? { ...log, attachments: (log.attachments ?? []).filter((file) => file.id !== attachment.id) }
        : log))
      add('ลบไฟล์หลักฐานแล้ว')
    } catch (error) {
      setAttachmentError((error as Error).message)
      add((error as Error).message, false)
    } finally {
      setAttachmentActionId(null)
    }
  }

  async function save() {
    if (!form.system_id) { add('กรุณาเลือกระบบ', false); return }
    if (!form.log_date) { add('กรุณาระบุวันที่', false); return }
    setSaving(true)
    setAttachmentError('')
    const filesToUpload = selectedFiles
    let uploadedCount = 0
    let recordSaved = false
    let savedId = form.id
    const payload = {
      system_id: form.system_id, log_date: form.log_date, activity: form.activity, result: form.result,
      performed_by: form.performed_by || null, note: form.note || null,
    }
    try {
      const res = await fetch(form.id ? `/api/admin/it-backup/${form.id}` : '/api/admin/it-backup', {
        method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'บันทึกไม่สำเร็จ')

      savedId = body.id ?? form.id
      if (!savedId) throw new Error('ไม่พบรหัสบันทึกสำหรับแนบไฟล์')
      recordSaved = true
      if (!form.id) setForm((current) => ({ ...current, id: savedId }))

      for (let index = 0; index < filesToUpload.length; index += 1) {
        setUploadStatus(`กำลังอัปโหลดหลักฐาน ${index + 1}/${filesToUpload.length}…`)
        await uploadAttachment(savedId, filesToUpload[index])
        uploadedCount = index + 1
      }

      add(form.id ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกแล้ว')
      setFormOpen(false)
      clearAttachmentState()
      await refetch()
    } catch (error) {
      const message = (error as Error).message
      if (recordSaved && savedId) {
        const latest = await refetch()
        const savedLog = latest?.find((log) => log.id === savedId)
        if (savedLog) setExistingAttachments(savedLog.attachments ?? [])
        setSelectedFiles(filesToUpload.slice(uploadedCount))
        setAttachmentError(`บันทึกข้อมูลแล้ว แต่แนบไฟล์ไม่สำเร็จ: ${message}`)
        add('บันทึกข้อมูลแล้ว แต่แนบไฟล์ไม่สำเร็จ', false)
      } else {
        add(message, false)
      }
    } finally {
      setSaving(false)
      setUploadStatus('')
    }
  }

  async function confirmDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/admin/it-backup/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { add('ลบแล้ว'); setDeleteId(null); await refetch() }
    else add('ลบไม่สำเร็จ', false)
  }

  return (
    <div>
      <PageHeader
        title="ทะเบียนการสำรองข้อมูล (Backup Log)"
        subtitle="บันทึกการสำรองข้อมูลและทดสอบการกู้คืนระบบสารสนเทศ"
        actions={canEdit ? <Button variant="primary" icon="plus" onClick={openAdd}>บันทึกรายการ</Button> : undefined}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Select value={systemFilter} onChange={setSystemFilter} placeholder="ทุกระบบ" options={systems.map((s) => ({ value: s.id, label: s.name }))} />
        {([['all', 'ทั้งหมด'], ['backup', 'สำรองข้อมูล'], ['restore_test', 'ทดสอบกู้คืน']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActivityFilter(key)} style={{
            padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border)',
            background: activityFilter === key ? 'var(--primary)' : 'transparent', color: activityFilter === key ? '#fff' : 'var(--ink)',
            fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }}>{label}</button>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={thStyle}>วันที่</th>
                <th style={thStyle}>ระบบ</th>
                <th style={thStyle}>กิจกรรม</th>
                <th style={thStyle}>ผลลัพธ์</th>
                <th style={thStyle}>หลักฐาน</th>
                <th style={thStyle}>ผู้ดำเนินการ</th>
                <th style={thStyle}>หมายเหตุ</th>
                {canEdit && <th style={{ ...thStyle, textAlign: 'right' }}>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)', transition: 'background .1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}>{fmtDate(l.log_date)}</td>
                  <td style={tdStyle}><Badge color="blue" size="sm">{l.system?.name ?? '-'}</Badge></td>
                  <td style={tdStyle}><Badge color={l.activity === 'restore_test' ? 'purple' : 'teal'} size="sm">{ACTIVITY_LABEL[l.activity]}</Badge></td>
                  <td style={tdStyle}><Badge color={l.result === 'success' ? 'green' : 'red'} size="sm" dot>{l.result === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}</Badge></td>
                  <td style={tdStyle}>
                    {(l.attachments ?? []).length > 0 ? (
                      <div style={{ display: 'grid', gap: 3, minWidth: 120, maxWidth: 190 }}>
                        {(l.attachments ?? []).map((attachment) => (
                          <a
                            key={attachment.id}
                            href={`/api/admin/it-backup/attachments/${attachment.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title={attachment.file_name}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, color: 'var(--primary)', textDecoration: 'none', fontSize: 12 }}
                          >
                            <Icon name={attachmentIcon(attachment.content_type)} size={14} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.file_name}</span>
                          </a>
                        ))}
                      </div>
                    ) : <span style={{ color: 'var(--muted)' }}>-</span>}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--muted)' }}>{l.performer?.name ?? '-'}</td>
                  <td style={{ ...tdStyle, color: 'var(--muted)', maxWidth: 240 }}>{l.note ?? '-'}</td>
                  {canEdit && (
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(l)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={15} /></button>
                      <button onClick={() => setDeleteId(l.id)} title="ลบ" style={{ ...iconBtn, color: 'var(--danger)' }}><Icon name="trash" size={15} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState title="ไม่มีบันทึกการสำรองข้อมูล" hint="บันทึกการสำรองข้อมูล/ทดสอบการกู้คืนตามรอบ" icon="download" />}
      </Card>

      {formOpen && (
        <Modal title={form.id ? 'แก้ไขบันทึกการสำรองข้อมูล' : 'บันทึกการสำรองข้อมูล'} onClose={closeForm}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>ระบบ *</label>
                <Select value={form.system_id} onChange={(v) => setForm((f) => ({ ...f, system_id: v }))} placeholder="— เลือกระบบ —"
                  style={{ width: '100%' }} options={activeSystems.map((s) => ({ value: s.id, label: s.name }))} />
              </div>
              <div>
                <label style={labelStyle}>วันที่ *</label>
                <input style={inputStyle} type="date" value={form.log_date} onChange={(e) => setForm((f) => ({ ...f, log_date: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>กิจกรรม</label>
                <Select value={form.activity} onChange={(v) => setForm((f) => ({ ...f, activity: v as Form['activity'] }))}
                  style={{ width: '100%' }} options={[{ value: 'backup', label: 'สำรองข้อมูล' }, { value: 'restore_test', label: 'ทดสอบกู้คืน' }]} />
              </div>
              <div>
                <label style={labelStyle}>ผลลัพธ์</label>
                <Select value={form.result} onChange={(v) => setForm((f) => ({ ...f, result: v as Form['result'] }))}
                  style={{ width: '100%' }} options={[{ value: 'success', label: 'สำเร็จ' }, { value: 'failed', label: 'ล้มเหลว' }]} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>ผู้ดำเนินการ</label>
              <Select value={form.performed_by} onChange={(v) => setForm((f) => ({ ...f, performed_by: v }))} placeholder="— ไม่ระบุ —"
                style={{ width: '100%' }} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
            </div>
            <div>
              <label style={labelStyle}>หมายเหตุ</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 5 }}>ไฟล์หลักฐาน</label>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>ไม่บังคับ</span>
              </div>
              <FileDropzone
                accept={ATTACHMENT_ACCEPT}
                multiple
                disabled={saving || Boolean(attachmentActionId) || selectedFiles.length >= MAX_NEW_ATTACHMENTS}
                onFiles={handleFiles}
                title={uploadStatus || (selectedFiles.length >= MAX_NEW_ATTACHMENTS ? 'เลือกไฟล์ครบจำนวนแล้ว' : 'ลากไฟล์หลักฐานมาวาง หรือคลิกเพื่อเลือก')}
                hint="รองรับ PDF, JPG, PNG, WEBP, XLS และ XLSX · ไฟล์ละไม่เกิน 20 MB"
              />
              {attachmentError && <p role="alert" style={{ margin: '7px 0 0', color: 'var(--danger)', fontSize: 12 }}>{attachmentError}</p>}

              {selectedFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: 'var(--muted)', fontSize: 11.5, fontWeight: 700 }}>ไฟล์ที่รอแนบ ({selectedFiles.length})</div>
                  <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${file.lastModified}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <Icon name={attachmentIcon(fileContentType(file))} size={15} />
                          <span style={{ minWidth: 0 }}>
                            <span title={file.name} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 600 }}>{file.name}</span>
                            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>{formatFileSize(file.size)}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`นำไฟล์ ${file.name} ออกจากรายการ`}
                          title="นำออก"
                          disabled={saving}
                          onClick={() => setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                          style={{ ...iconBtn, flex: '0 0 auto', width: 28, height: 28, marginLeft: 0 }}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingAttachments.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: 'var(--muted)', fontSize: 11.5, fontWeight: 700 }}>ไฟล์ที่แนบไว้แล้ว ({existingAttachments.length})</div>
                  <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                    {existingAttachments.map((attachment) => (
                      <div key={attachment.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <a href={`/api/admin/it-backup/attachments/${attachment.id}`} target="_blank" rel="noreferrer" title={attachment.file_name} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, color: 'var(--primary)', textDecoration: 'none' }}>
                          <Icon name={attachmentIcon(attachment.content_type)} size={15} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 600 }}>{attachment.file_name}</span>
                            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>{formatFileSize(attachment.size_bytes)}</span>
                          </span>
                        </a>
                        <Button variant="ghost" size="sm" icon="trash" onClick={() => void removeExistingAttachment(attachment)} disabled={saving || Boolean(attachmentActionId)}>ลบ</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>ยกเลิก</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{uploadStatus || (saving ? 'กำลังบันทึก…' : 'บันทึก')}</Button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="ยืนยันการลบ" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 13.5, margin: 0 }}>ต้องการลบบันทึกการสำรองข้อมูลนี้ใช่หรือไม่?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>ยกเลิก</Button>
            <Button variant="danger" onClick={confirmDelete}>ลบ</Button>
          </div>
        </Modal>
      )}

      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#fff', background: t.ok ? 'var(--success)' : 'var(--danger)', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{title}</h2>
          <button onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', width: 30, height: 30, borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
