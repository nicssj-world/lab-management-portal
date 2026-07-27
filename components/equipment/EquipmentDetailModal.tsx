'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'
import { isPdfLike, viewerFileNameFromPath } from '@/lib/pdf-viewer-utils'
import type { Equipment } from '@/lib/queries/equipment'

type RiskLevel = 'High' | 'Medium' | 'Low'
type ViewerState = { url: string; pdfJsUrl?: string | null; title: string }

const RISK_BADGE: Record<RiskLevel, 'red' | 'amber' | 'teal'> = {
  High: 'red', Medium: 'amber', Low: 'teal',
}

const STATUS_BADGE: Record<Equipment['status'], 'green' | 'gray' | 'red' | 'blue' | 'purple' | 'amber'> = {
  Active: 'green', Inactive: 'gray', ชำรุด: 'red', มาใหม่: 'blue', ย้าย: 'purple', สูญหาย: 'amber',
}

interface EquipmentDetailModalProps {
  item?: Equipment
  equipmentId?: string
  onClose: () => void
  onEdit?: (item: Equipment) => void
}

function warrantyStatus(exp: string | null): 'ok' | 'warn' | 'danger' | null {
  if (!exp) return null
  const days = (new Date(exp).getTime() - Date.now()) / 86400000
  if (days < 30) return 'danger'
  if (days < 90) return 'warn'
  return 'ok'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return value }
}

function formatPrice(value: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: 1, textTransform: 'uppercase', margin: '18px 0 4px' }}>{children}</div>
}

function openPdfOrNewTab(url: string, filePath: string, setViewer: (viewer: ViewerState) => void, pdfJsUrl: string) {
  if (isPdfLike({ fileName: filePath })) {
    setViewer({ url, pdfJsUrl, title: viewerFileNameFromPath(filePath) })
  } else {
    window.open(url, '_blank')
  }
}

function DocDownloadRow({ equipmentId, filePath }: { equipmentId: string; filePath: string }) {
  const [loading, setLoading] = useState(false)
  const [viewer, setViewer] = useState<ViewerState | null>(null)

  async function handleDownload() {
    setLoading(true)
    try {
      const docType = 'manual'
      const response = await fetch(`/api/admin/equipment/${equipmentId}/docs?doc_type=${docType}`)
      if (!response.ok) return
      const { url } = await response.json()
      openPdfOrNewTab(url, filePath, setViewer, `/api/admin/equipment/${equipmentId}/docs?doc_type=${docType}&proxy=1`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
        <Icon name="doc" size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>คู่มือการใช้งานเครื่องมือ</span>
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', color: 'var(--primary)', opacity: loading ? .6 : 1 }}
        >
          <Icon name="download" size={12} />
          {loading ? 'กำลังโหลด...' : isPdfLike({ fileName: filePath }) ? 'อ่าน' : 'ดาวน์โหลด'}
        </button>
      </div>
      {viewer ? <PdfViewerModal url={viewer.url} pdfJsUrl={viewer.pdfJsUrl} title={viewer.title} onClose={() => setViewer(null)} /> : null}
    </>
  )
}

export function EquipmentDetailModal({ item, equipmentId, onClose, onEdit }: EquipmentDetailModalProps) {
  const [loadedItem, setLoadedItem] = useState<Equipment | null>(item ?? null)
  const [loadError, setLoadError] = useState('')
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null)
  const resolvedItem = item ?? loadedItem

  useEffect(() => {
    if (item || !equipmentId) return
    const controller = new AbortController()
    setLoadedItem(null)
    setLoadError('')
    fetch(`/api/admin/equipment/${equipmentId}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error ?? 'ไม่สามารถโหลดรายละเอียดเครื่องมือได้')
        setLoadedItem(data as Equipment)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียดเครื่องมือได้')
      })
    return () => controller.abort()
  }, [equipmentId, item])

  useEffect(() => {
    setSignedPhotoUrl(null)
    if (!resolvedItem?.photo_url) return
    const controller = new AbortController()
    fetch(`/api/admin/equipment/${resolvedItem.id}/photo`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.url) setSignedPhotoUrl(data.url) })
      .catch(() => {})
    return () => controller.abort()
  }, [resolvedItem?.id, resolvedItem?.photo_url])

  const ws = resolvedItem ? warrantyStatus(resolvedItem.warranty_exp) : null

  return (
    <div role="dialog" aria-modal="true" aria-label="รายละเอียดเครื่องมือ" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.4 }}>{resolvedItem?.equipment_type ?? 'รายละเอียดเครื่องมือ'}</div>
            {resolvedItem ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {resolvedItem.cbh_code ? <span style={{ fontSize: 12, color: 'var(--primary)', fontFamily: 'monospace', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: 5 }}>{resolvedItem.cbh_code}</span> : null}
                <Badge color={STATUS_BADGE[resolvedItem.status]}>{resolvedItem.status}</Badge>
                {resolvedItem.risk_level ? <Badge color={RISK_BADGE[resolvedItem.risk_level as RiskLevel]}>{resolvedItem.risk_level}</Badge> : null}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {resolvedItem && onEdit ? (
              <button type="button" onClick={() => onEdit(resolvedItem)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)' }}>
                <Icon name="edit" size={13} /> แก้ไข
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="ปิดรายละเอียดเครื่องมือ" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '4px 24px 24px', overflow: 'auto', flex: 1 }}>
          {!resolvedItem && !loadError ? (
            <div style={{ minHeight: 180, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลดรายละเอียด…</div>
          ) : loadError ? (
            <div role="alert" style={{ minHeight: 180, display: 'grid', placeItems: 'center', color: 'var(--danger)', fontSize: 13 }}>{loadError}</div>
          ) : resolvedItem ? (
            <>
              <SectionTitle>ข้อมูลทั่วไป</SectionTitle>
              {resolvedItem.photo_url ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, marginTop: 4 }}>
                  {signedPhotoUrl
                    ? <img src={signedPhotoUrl} alt={resolvedItem.equipment_type} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', padding: 8 }} />
                    : <div style={{ width: 160, height: 100, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="flask" size={24} style={{ color: 'var(--muted)', opacity: .4 }} /></div>}
                </div>
              ) : null}
              <DetailRow label="แผนก" value={resolvedItem.department} />
              <DetailRow label="เลขทะเบียนสินทรัพย์" value={resolvedItem.hospital_asset_no} />
              <DetailRow label="LAB Code" value={resolvedItem.cbh_code ? <span style={{ fontFamily: 'monospace' }}>{resolvedItem.cbh_code}</span> : null} />
              <DetailRow label="Classification" value={resolvedItem.classification} />
              <DetailRow label="ผู้รับผิดชอบ" value={resolvedItem.responsible_person} />
              <DetailRow label="เจ้าของ" value={resolvedItem.owner} />
              <DetailRow label="Owner Status" value={resolvedItem.owner_status} />

              <SectionTitle>ผู้ผลิต / จำหน่าย</SectionTitle>
              <DetailRow label="Manufacturer" value={resolvedItem.manufacturer} />
              <DetailRow label="Model" value={resolvedItem.model} />
              <DetailRow label="Serial Number" value={resolvedItem.serial_number ? <span style={{ fontFamily: 'monospace' }}>{resolvedItem.serial_number}</span> : null} />
              <DetailRow label="Vendor" value={resolvedItem.vendor} />

              <SectionTitle>การจัดซื้อ</SectionTitle>
              <DetailRow label="วันที่ซื้อ" value={formatDate(resolvedItem.purchase_date)} />
              <DetailRow label="วันหมดประกัน" value={resolvedItem.warranty_exp ? <span style={{ color: ws === 'danger' ? 'var(--danger)' : ws === 'warn' ? 'var(--warning)' : 'var(--ink)', fontWeight: ws !== 'ok' ? 600 : 400 }}>{ws !== 'ok' ? <Icon name="alert" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : null}{formatDate(resolvedItem.warranty_exp)}</span> : null} />
              <DetailRow label="ราคาซื้อ (บาท)" value={resolvedItem.purchase_price != null ? formatPrice(resolvedItem.purchase_price) : null} />

              <SectionTitle>การสอบเทียบ</SectionTitle>
              <DetailRow label="ต้องการสอบเทียบ" value={resolvedItem.needs_calibration ? <Badge color="blue" dot>ต้องการ</Badge> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>ไม่ต้องการ</span>} />
              <DetailRow label="จุดประสงค์การใช้งาน" value={resolvedItem.purpose} />

              {resolvedItem.remark ? <><SectionTitle>หมายเหตุ</SectionTitle><div style={{ fontSize: 13, color: 'var(--ink)', padding: '8px 0', lineHeight: 1.6 }}>{resolvedItem.remark}</div></> : null}
              {resolvedItem.manual_url ? <><SectionTitle>เอกสารประกอบ</SectionTitle><DocDownloadRow equipmentId={resolvedItem.id} filePath={resolvedItem.manual_url} /></> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
