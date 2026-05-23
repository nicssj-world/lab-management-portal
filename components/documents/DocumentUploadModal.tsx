'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { DOC_TYPES, DOC_STATUSES, DOC_VISIBILITIES } from '@/lib/validations/document'
import { availableEditStatuses } from '@/lib/documents/transitions'
import type { DocStatus } from '@/lib/documents/transitions'
import type { Document } from '@/lib/supabase/types'

interface Props {
  doc?: Document | null
  userRole?: string
  docRole?: string
  onClose: () => void
  onSaved: (doc: Document) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)',
  background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

function RequiredMark() {
  return <span style={{ color: 'var(--danger)' }}> *</span>
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const DEPT_BY_PREFIX: Record<string, string> = {
  QP: 'กลุ่มงานเทคนิคการแพทย์',
  QM: 'กลุ่มงานเทคนิคการแพทย์',
  MN: 'กลุ่มงานเทคนิคการแพทย์',
  OV: 'กลุ่มงานเทคนิคการแพทย์',
  BB: 'งานคลังเลือด',
  MI: 'งานจุลชีววิทยาคลินิก',
  HE: 'งานโลหิตวิทยาคลินิก',
  IM: 'งานภูมิคุ้มกันวิทยาคลินิก',
  MP: 'งานจุลทรรศน์ศาสตร์คลินิก',
  CC: 'งานเคมีคลินิก',
  LM: 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  BM: 'งานอณูชีววิทยา',
  SR: 'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
}

function deptFromCode(code: string): string | null {
  for (const seg of code.split('-')) {
    const prefix = seg.match(/^([A-Z]{2})/)?.[1] ?? ''
    if (DEPT_BY_PREFIX[prefix]) return DEPT_BY_PREFIX[prefix]
  }
  return null
}

function revisionNumber(v: string): number | null {
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : null
}

export function DocumentUploadModal({ doc, userRole, docRole, onClose, onSaved }: Props) {
  const availableStatuses = availableEditStatuses(
    userRole ?? '',
    docRole,
    doc?.status as DocStatus | undefined,
  )
  const isEdit = !!doc
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle]               = useState(doc?.title ?? '')
  const [documentCode, setDocumentCode] = useState(doc?.document_code ?? '')
  const [type, setType]                 = useState<string>(doc?.type ?? 'QP')
  const [visibility, setVisibility]     = useState<string>(doc?.visibility ?? 'Internal')
  const [status, setStatus]             = useState<string>(doc?.status ?? 'Draft')
  const [revision, setRevision]         = useState(doc?.revision ?? '1')
  const [ownerName, setOwnerName]       = useState(doc?.owner_name ?? '')
  const [reviewerName, setReviewerName] = useState(doc?.reviewer_name ?? '')
  const [approverName, setApproverName] = useState(doc?.approver_name ?? '')
  const [department, setDepartment]     = useState(doc?.department ?? '')
  const [expiryDate, setExpiryDate]     = useState(doc?.expiry_date ?? '')
  const [effectiveDate, setEffectiveDate] = useState(doc?.effective_date ?? '')
  const [obsoleteDate, setObsoleteDate] = useState(doc?.obsolete_date ?? '')
  const [obsoleteReason, setObsoleteReason] = useState(doc?.obsolete_reason ?? '')
  const [description, setDescription]   = useState(doc?.description ?? '')

  const isObsolete = status === 'Obsolete'
  const originalRevision = doc?.revision ?? '1'
  const originalRevisionNumber = revisionNumber(originalRevision)
  const currentRevisionNumber = revisionNumber(revision)
  const revisionChanged = isEdit && revision.trim() !== originalRevision.trim()
  const revisionMustIncrease = revisionChanged
    && originalRevisionNumber !== null
    && (currentRevisionNumber === null || currentRevisionNumber <= originalRevisionNumber)
  const revisionWarning = revisionMustIncrease
    ? `Revision ใหม่ต้องเป็นตัวเลขที่สูงกว่า Rev. ${originalRevision}`
    : ''

  const handleFile = useCallback((file: File) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|xlsx)$/i)) {
      setError('รองรับเฉพาะไฟล์ PDF, DOCX, XLSX เท่านั้น')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์ต้องไม่เกิน 50 MB')
      return
    }
    setError('')
    setSelectedFile(file)
  }, [])

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current += 1
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current === 0) setDragOver(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function handleSave() {
    if (!title.trim())         { setError('กรุณากรอกชื่อเอกสาร'); return }
    if (!documentCode.trim())  { setError('กรุณากรอกรหัสเอกสาร'); return }
    if (!isEdit && !selectedFile) { setError('กรุณาเลือกไฟล์'); return }
    if (revisionWarning) { setError(revisionWarning); return }

    setSaving(true)
    setError('')

    try {
      const meta: Record<string, string | undefined> = {
        title:          title.trim(),
        document_code:  documentCode.trim().toUpperCase(),
        type,
        visibility,
        status,
        revision:       revision.trim() || '1',
        owner_name:     ownerName.trim()     || undefined,
        reviewer_name:  reviewerName.trim()  || undefined,
        approver_name:  approverName.trim()  || undefined,
        department:     department.trim()    || undefined,
        expiry_date:    expiryDate           || undefined,
        effective_date: effectiveDate        || undefined,
        obsolete_date:  isObsolete ? (obsoleteDate || new Date().toISOString().split('T')[0]) : undefined,
        obsolete_reason: isObsolete ? (obsoleteReason.trim() || undefined) : undefined,
        description:    description.trim() || undefined,
      }

      let res: Response

      if (isEdit) {
        if (selectedFile) {
          const fd = new FormData()
          fd.append('file', selectedFile)
          fd.append('meta', JSON.stringify(meta))
          res = await fetch(`/api/admin/documents/${doc!.id}`, { method: 'PATCH', body: fd })
        } else {
          res = await fetch(`/api/admin/documents/${doc!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(meta),
          })
        }
      } else {
        const fd = new FormData()
        fd.append('file', selectedFile!)
        fd.append('meta', JSON.stringify(meta))
        res = await fetch('/api/admin/documents', { method: 'POST', body: fd })
      }

      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'เกิดข้อผิดพลาด'); setSaving(false); return }
      onSaved(json as Document)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 620,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            {isEdit ? 'แก้ไขเอกสาร' : 'Upload เอกสาร'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: '#B91C1C', fontSize: 13, border: '1px solid rgba(220,38,38,.2)' }}>
              {error}
            </div>
          )}

          {/* ชื่อเอกสาร */}
          <div>
            <label style={labelStyle}>ชื่อเอกสาร<RequiredMark /></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="คู่มือคุณภาพ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี" />
          </div>

          {/* รหัสเอกสาร + ประเภท */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>รหัสเอกสาร<RequiredMark /></label>
              <input
                value={documentCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase()
                  setDocumentCode(val)
                  const dept = deptFromCode(val)
                  if (dept) setDepartment(dept)
                }}
                style={inputStyle}
                placeholder="เช่น QM-LAB-01"
              />
            </div>
            <div>
              <label style={labelStyle}>ประเภทเอกสาร<RequiredMark /></label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle }}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* การเผยแพร่ + สถานะ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>การเผยแพร่</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={{ ...inputStyle }}>
                {DOC_VISIBILITIES.map((v) => <option key={v} value={v}>{v === 'Public' ? 'Public — เผยแพร่' : 'Internal — ภายใน'}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>สถานะ</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle }}>
                {availableStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Revision + แผนก */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Revision</label>
              <input
                value={revision}
                onChange={(e) => {
                  setRevision(e.target.value)
                  if (error === revisionWarning) setError('')
                }}
                onBlur={() => {
                  if (revisionWarning) {
                    alert(revisionWarning)
                    setError(revisionWarning)
                  }
                }}
                style={{
                  ...inputStyle,
                  borderColor: revisionWarning ? 'rgba(220,38,38,.55)' : 'var(--border)',
                  background: revisionWarning ? 'rgba(220,38,38,.04)' : 'var(--card)',
                }}
                placeholder="1"
              />
              {revisionWarning && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger)', lineHeight: 1.35 }}>
                  {revisionWarning}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>แผนก</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} style={inputStyle} placeholder="เช่น เคมีคลินิก" />
            </div>
          </div>

          {/* ผู้จัดทำ + ผู้รับรอง + ผู้อนุมัติ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>ผู้จัดทำ</label>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={inputStyle} placeholder="ชื่อผู้จัดทำ" />
            </div>
            <div>
              <label style={labelStyle}>ผู้รับรอง</label>
              <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} style={inputStyle} placeholder="ชื่อผู้รับรอง" />
            </div>
            <div>
              <label style={labelStyle}>ผู้อนุมัติ</label>
              <input value={approverName} onChange={(e) => setApproverName(e.target.value)} style={inputStyle} placeholder="ชื่อผู้อนุมัติ" />
            </div>
          </div>

          {/* วันที่ทบทวน + วันที่มีผลบังคับใช้ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>วันที่ทบทวน</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>วันที่มีผลบังคับใช้</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* วันที่ยกเลิก + เหตุผล (เฉพาะ Obsolete) */}
          {isObsolete && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 16px', borderRadius: 10, background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.15)' }}>
              <div>
                <label style={{ ...labelStyle, color: 'var(--danger)' }}>วันที่ยกเลิก</label>
                <input type="date" value={obsoleteDate} onChange={(e) => setObsoleteDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: 'var(--danger)' }}>เหตุผลที่ยกเลิก</label>
                <input value={obsoleteReason} onChange={(e) => setObsoleteReason(e.target.value)} style={inputStyle} placeholder="เหตุผล (ไม่บังคับ)" />
              </div>
            </div>
          )}

          {/* รายละเอียดการแก้ไข */}
          <div>
            <label style={labelStyle}>รายละเอียดการแก้ไข</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="สรุปสิ่งที่เปลี่ยนแปลงในฉบับนี้ (ไม่บังคับ)"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* File Upload */}
          <div>
            <label style={labelStyle}>
              {isEdit ? 'เปลี่ยนไฟล์ (ไม่บังคับ)' : <>ไฟล์เอกสาร<RequiredMark /> (PDF, DOCX, XLSX — ไม่เกิน 50 MB)</>}
            </label>
            <div
              onDragEnter={onDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 10, padding: '20px 16px',
                background: dragOver ? 'var(--primary-soft)' : 'var(--surface-2)',
                cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
              }}
            >
              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Icon name="doc" size={18} style={{ color: 'var(--primary)' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fmtSize(selectedFile.size)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                    style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  <Icon name="upload" size={22} style={{ color: 'var(--muted)', marginBottom: 8 }} />
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    ลากไฟล์มาวางที่นี่ หรือ <span style={{ color: 'var(--primary)', fontWeight: 600 }}>เลือกไฟล์</span>
                  </div>
                </div>
              )}
              <input
                ref={fileRef} type="file"
                accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' }}
          >
            ยกเลิก
          </button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !!revisionWarning}>
            {saving ? (isEdit ? 'กำลังบันทึก...' : 'กำลัง Upload...') : (isEdit ? 'บันทึกการแก้ไข' : 'Upload เอกสาร')}
          </Button>
        </div>
      </div>
    </div>
  )
}
