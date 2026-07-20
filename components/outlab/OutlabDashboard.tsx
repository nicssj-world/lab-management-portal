'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { OutlabCertificate, OutlabFile, OutlabOverview } from '@/lib/outlab/types'
import { catalogServiceDefaults, findOutlabCatalogTestByEphisCode, isOutlabCatalogTest, OUTLAB_SECTOR_LABEL } from '@/lib/outlab/domain'
import { RecordEditDialog, type RecordEditField } from '@/components/external-quality/RecordEditDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { OUTLAB_NAVIGATION } from '@/lib/navigation'

export type OutlabSection = 'dashboard' | 'laboratories' | 'services' | 'certificates' | 'settings'
const urgencyLabel: Record<string, string> = { valid: 'ปกติ > 90 วัน', watch: 'เฝ้าระวัง 61–90 วัน', urgent: 'เร่งด่วน 31–60 วัน', critical: 'วิกฤต 0–30 วัน', expired: 'หมดอายุ', inactive: 'ไม่แจ้งเตือน' }

async function jsonRequest(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(payload?.error ?? 'บันทึกไม่สำเร็จ')
  return payload
}

const field = { display: 'flex', flexDirection: 'column' as const, gap: 5 }
const input = { minHeight: 38, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' }
const button = { minHeight: 38, border: 0, borderRadius: 8, padding: '0 14px', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }
const fmt = (date: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
type EditDialog = { title: string; fields: RecordEditField[]; initialValues: Record<string, unknown>; onSave: (values: Record<string, unknown>) => Promise<void> }

function CertificateFiles({ certificate, canEdit, refresh, onView }: { certificate: OutlabCertificate; canEdit: boolean; refresh: () => void; onView: (file: OutlabFile) => void }) {
  const [busy, setBusy] = useState(false)
  async function upload(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const target = { certificateId: certificate.id, fileName: file.name, contentType: file.type, sizeBytes: file.size }
      const presigned = await jsonRequest('/api/admin/outlab/attachments/presign', 'POST', target)
      const put = await fetch(presigned.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) throw new Error('อัปโหลดไปพื้นที่จัดเก็บไม่สำเร็จ')
      await jsonRequest('/api/admin/outlab/attachments/finalize', 'POST', { ...target, key: presigned.key })
      refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'อัปโหลดไม่สำเร็จ') } finally { setBusy(false) }
  }
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 8 }}>
    {canEdit && <label style={{ ...button, minHeight: 30, display: 'inline-flex', alignItems: 'center', fontSize: 11, background: '#475569' }}>{busy ? 'กำลังอัปโหลด…' : '+ แนบไฟล์'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" hidden disabled={busy} onChange={event => upload(event.target.files?.[0])} /></label>}
    {certificate.files.map((file, index) => <span key={file.id} style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => onView(file)}
        aria-label={`ดูไฟล์ ${file.file_name}`}
        title={file.file_name}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'background .15s, border-color .15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-soft)'; e.currentTarget.style.borderColor = 'var(--primary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <Icon name="eye" size={15} />
        {certificate.files.length > 1 && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{index + 1}</span>}
      </button>
      {canEdit && <button aria-label={`ลบไฟล์ ${file.file_name}`} title="ลบไฟล์" onClick={async () => { if (confirm('ลบไฟล์นี้?')) { await fetch(`/api/admin/outlab/attachments/${file.id}`, { method: 'DELETE' }); refresh() } }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 30, border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>×</button>}
    </span>)}
    {certificate.files.length === 0 && !canEdit && <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
  </div>
}

function CertificateFileView({ file }: { file: OutlabFile }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; blobUrl?: string; message?: string }>({ status: 'loading' })
  useEffect(() => {
    let blobUrl: string | null = null
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/admin/outlab/attachments/${file.id}`)
      .then(async res => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error || `โหลดไฟล์ไม่สำเร็จ (${res.status})`)
        }
        const blob = await res.blob()
        if (cancelled) return
        blobUrl = URL.createObjectURL(blob)
        setState({ status: 'ready', blobUrl })
      })
      .catch(error => { if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : 'โหลดไฟล์ไม่สำเร็จ' }) })
    return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [file.id])

  if (state.status === 'loading') return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /><span style={{ fontSize: 13, color: 'rgba(255,255,255,.72)' }}>กำลังโหลดไฟล์…</span><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (state.status === 'error') return <div style={{ padding: 40, textAlign: 'center' }}><p style={{ color: '#fff', marginBottom: 6, fontWeight: 700 }}>เปิดไฟล์ไม่ได้</p><p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13 }}>{state.message}</p></div>
  const url = state.blobUrl!
  if (file.content_type.startsWith('image/')) return <img src={url} alt={file.file_name} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', margin: '0 auto', objectFit: 'contain' }} />
  if (file.content_type === 'application/pdf') return <iframe src={url} title={file.file_name} style={{ width: '100%', height: '100%', border: 0, background: '#525659' }} />
  return <div style={{ padding: 40, textAlign: 'center' }}>
    <p style={{ color: '#fff', marginBottom: 16 }}>ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ในหน้าเว็บได้</p>
    <a href={url} download={file.file_name} style={{ ...button, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>ดาวน์โหลดไฟล์</a>
  </div>
}

function CertificateFilePreview({ file, onClose }: { file: OutlabFile; onClose: () => void }) {
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
    <div style={{ height: 56, background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</div>
      <a href={`/api/admin/outlab/attachments/${file.id}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--muted)', textDecoration: 'none', fontFamily: 'inherit' }}><Icon name="download" size={13} /> ดาวน์โหลด</a>
      <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}><Icon name="x" size={16} /></button>
    </div>
    <div style={{ flex: 1, overflow: 'auto', background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CertificateFileView file={file} />
    </div>
  </div>
}

export function OutlabDashboard({ overview, canEdit, isAdmin, activeSection }: { overview: OutlabOverview; canEdit: boolean; isAdmin: boolean; activeSection: OutlabSection }) {
  const router = useRouter()
  const search = useSearchParams()
  const tab = activeSection
  const [error, setError] = useState('')
  const [editors, setEditors] = useState<string[]>([])
  const [editor, setEditor] = useState<EditDialog | null>(null)
  const [previewFile, setPreviewFile] = useState<OutlabFile | null>(null)
  const existingServiceTestIds = useMemo(
    () => new Set(overview.services.flatMap(service => service.test_id == null ? [] : [service.test_id])),
    [overview.services],
  )
  const availableOutlabCatalogTests = useMemo(
    () => overview.tests.filter(test => isOutlabCatalogTest(test) && !existingServiceTestIds.has(test.id)),
    [overview.tests, existingServiceTestIds],
  )
  function autofillCatalogService(form: HTMLFormElement | null, value: string, source: 'id' | 'code' = 'id') {
    if (!form) return
    const test = source === 'code'
      ? findOutlabCatalogTestByEphisCode(availableOutlabCatalogTests, value)
      : availableOutlabCatalogTests.find(item => String(item.id) === value)
    if (!test) return
    const defaults = catalogServiceDefaults(test)
    const set = (name: string, value: string) => {
      const input = form.elements.namedItem(name)
      if (input instanceof HTMLInputElement) input.value = value
    }
    set('method', defaults.method)
    set('transportCondition', defaults.transportCondition)
    set('tatText', defaults.tatText)
    set('price', defaults.price == null ? '' : String(defaults.price))
    set('ephisCode', test.code)
    const select = form.elements.namedItem('testId')
    if (select instanceof HTMLSelectElement) select.value = String(test.id)
  }
  const certs = useMemo(() => overview.laboratories.flatMap(lab => lab.certificates), [overview.laboratories])
  const laboratoriesWithoutCurrentCertificate = useMemo(
    () => overview.laboratories.filter(lab => lab.active && !lab.certificates.some(cert => cert.lifecycle === 'current')),
    [overview.laboratories],
  )
  const labName = useMemo(() => new Map(overview.laboratories.map(lab => [lab.id, lab.name])), [overview.laboratories])
  const testCode = useMemo(() => new Map(overview.tests.map(test => [test.id, test.code])), [overview.tests])
  const filter = search.get('filter')
  const alertCerts = certs.filter(cert => cert.lifecycle === 'current' && (filter === 'expired' ? cert.urgency === 'expired' : ['watch', 'urgent', 'critical', 'expired'].includes(cert.urgency)))
  const refresh = () => router.refresh()
  useEffect(() => { if (tab === 'settings') fetch('/api/admin/outlab/editors').then(r => r.json()).then(data => setEditors(data.userIds ?? [])).catch(() => {}) }, [tab])

  async function submit(path: string, body: unknown, form: HTMLFormElement) {
    try { setError(''); await jsonRequest(path, 'POST', body); form.reset(); refresh() } catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ') }
  }
  async function deactivate(path: string, label: string) {
    if (!confirm(`${label} ใช่หรือไม่?`)) return
    try { setError(''); await jsonRequest(path, 'DELETE', {}); refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ') }
  }
  function editLaboratory(lab: any) {
    setEditor({ title: `แก้ไขห้องปฏิบัติการ: ${lab.name}`, fields: [
      { key: 'name', label: 'ชื่อ', required: true }, { key: 'sector', label: 'ประเภท', type: 'select', options: [{ value: 'gov', label: 'ภาครัฐ' }, { value: 'priv', label: 'เอกชน' }, { value: 'other', label: 'อื่น ๆ' }] },
      { key: 'brand', label: 'หน่วยงาน' }, { key: 'contactPhone', label: 'โทรศัพท์' }, { key: 'contactEmail', label: 'อีเมล', type: 'email' }, { key: 'address', label: 'ที่อยู่', type: 'textarea' }, { key: 'publicAccreditationSummary', label: 'มาตรฐานสำหรับเผยแพร่' }, { key: 'active', label: 'ใช้งาน', type: 'checkbox' }, { key: 'publishPublic', label: 'แสดงในคู่มือสาธารณะ', type: 'checkbox' },
    ], initialValues: { name: lab.name, sector: lab.sector, brand: lab.brand, contactPhone: lab.contact_phone, contactEmail: lab.contact_email, address: lab.address, publicAccreditationSummary: lab.public_accreditation_summary, active: lab.active, publishPublic: lab.publish_public }, onSave: async values => {
      await jsonRequest(`/api/admin/outlab/laboratories/${lab.id}`, 'PATCH', { sector: values.sector, name: values.name, brand: values.brand || null, address: values.address || null, contactName: lab.contact_name, contactPhone: values.contactPhone || null, contactEmail: values.contactEmail || null, publicAccreditationSummary: values.publicAccreditationSummary || null, active: Boolean(values.active), publishPublic: Boolean(values.publishPublic), remark: lab.remark, ownerIds: lab.ownerIds, primaryOwnerId: lab.primaryOwnerId }); refresh()
    } })
  }
  function editService(service: any) {
    setEditor({ title: `แก้ไขบริการ: ${service.test_name_snapshot}`, fields: [
      { key: 'testNameSnapshot', label: 'ชื่อรายการตรวจ', required: true }, { key: 'externalCode', label: 'รหัสภายนอก' }, { key: 'method', label: 'วิธีตรวจ' }, { key: 'specimen', label: 'สิ่งส่งตรวจ' }, { key: 'transportCondition', label: 'การขนส่ง' }, { key: 'tatText', label: 'TAT' }, { key: 'price', label: 'ราคา', type: 'number' }, { key: 'isPrimary', label: 'ห้องหลัก', type: 'checkbox' }, { key: 'active', label: 'ใช้งาน', type: 'checkbox' },
    ], initialValues: { testNameSnapshot: service.test_name_snapshot, externalCode: service.external_code, method: service.method, specimen: service.specimen, transportCondition: service.transport_condition, tatText: service.tat_text, price: service.price, isPrimary: service.is_primary, active: service.active }, onSave: async values => {
      await jsonRequest(`/api/admin/outlab/services/${service.id}`, 'PATCH', { laboratoryId: service.laboratory_id, testId: service.test_id, manualTestName: null, testNameSnapshot: values.testNameSnapshot, externalCode: values.externalCode || null, method: values.method || null, specimen: values.specimen || null, transportCondition: values.transportCondition || null, tatText: values.tatText || null, price: values.price ?? null, isPrimary: Boolean(values.isPrimary), active: Boolean(values.active), remark: service.remark }); refresh()
    } })
  }
  function editCertificate(cert: OutlabCertificate) {
    setEditor({ title: `แก้ไขใบรับรอง: ${cert.standard_name}`, fields: [
      { key: 'standardName', label: 'มาตรฐาน', required: true }, { key: 'accreditationBody', label: 'หน่วยรับรอง' }, { key: 'certificateNo', label: 'เลขที่ใบ' }, { key: 'scope', label: 'ขอบข่าย', type: 'textarea' }, { key: 'validFrom', label: 'วันเริ่ม', type: 'date' }, { key: 'expiresOn', label: 'วันหมดอายุ', type: 'date', required: true }, { key: 'lifecycle', label: 'สถานะ', type: 'select', options: [{ value: 'current', label: 'Current' }, { value: 'superseded', label: 'Superseded' }, { value: 'revoked', label: 'Revoked' }] },
    ], initialValues: { standardName: cert.standard_name, accreditationBody: cert.accreditation_body, certificateNo: cert.certificate_no, scope: cert.scope, validFrom: cert.valid_from, expiresOn: cert.expires_on, lifecycle: cert.lifecycle }, onSave: async values => {
      await jsonRequest(`/api/admin/outlab/certificates/${cert.id}`, 'PATCH', { laboratoryId: cert.laboratory_id, standardName: values.standardName, accreditationBody: values.accreditationBody || null, certificateNo: values.certificateNo || null, scope: values.scope || null, validFrom: values.validFrom || null, expiresOn: values.expiresOn, lifecycle: values.lifecycle, supersedesId: cert.supersedes_id, remark: cert.remark }); refresh()
    } })
  }

  return <div className="eq-wrap quality-module">
    <style>{`.eq-wrap{display:flex;flex-direction:column;gap:16px}.eq-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.eq-tabs{display:flex;gap:5px;flex-wrap:wrap;border-bottom:1px solid var(--border)}.eq-tab{border:0;background:transparent;color:var(--muted);padding:10px 12px;font-family:inherit;font-weight:700;cursor:pointer;border-bottom:2px solid transparent}.eq-tab.on{color:var(--primary);border-color:var(--primary)}.eq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.eq-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:end}.eq-table{width:100%;border-collapse:collapse;font-size:12.5px}.eq-table th,.eq-table td{text-align:left;padding:9px;border-bottom:1px solid var(--border);vertical-align:top}.eq-table th{color:var(--muted);font-size:11px}.eq-scroll{overflow:auto}.eq-badge{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:10.5px;font-weight:700;background:var(--surface-2)}.outlab-services-table{min-width:1200px;table-layout:fixed;font-size:13px}.outlab-services-table th,.outlab-services-table td{padding:12px 10px}.outlab-services-table tbody tr:hover{background:var(--surface-2)}.outlab-services-table strong{display:block;line-height:1.45}.outlab-service-meta{display:block;margin-top:3px;color:var(--muted);font-size:11.5px;line-height:1.35}.outlab-service-ephis{font-variant-numeric:tabular-nums;white-space:nowrap}.outlab-service-detail{line-height:1.4}.outlab-service-detail+ .outlab-service-detail{margin-top:4px;color:var(--muted)}.outlab-service-price{text-align:right!important;font-variant-numeric:tabular-nums;white-space:nowrap}.outlab-service-primary{text-align:center!important}.outlab-service-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.outlab-service-actions button{white-space:nowrap}.outlab-primary-mark{color:#15803D;font-size:16px;font-weight:800}.outlab-no-primary{color:var(--muted)}@media(max-width:600px){.eq-form{grid-template-columns:1fr}.eq-table{min-width:720px}.outlab-services-table{min-width:1120px}}`}</style>
    <PageHeader eyebrow="EXTERNAL LABORATORY" title="ห้องปฏิบัติการภายนอก" subtitle="บริการส่งต่อ มาตรฐาน และใบรับรองของห้องปฏิบัติการภายนอก" marginBottom={0} actions={<div className="quality-module-actions"><a style={{ ...button, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', background: '#15803D' }} href="/api/admin/outlab/export">Excel</a><a style={{ ...button, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', background: '#B91C1C' }} href="/api/admin/outlab/export?format=pdf">PDF</a></div>} />
    <ModuleSubnav items={OUTLAB_NAVIGATION.filter(item => item.id !== 'settings' || isAdmin)} label="เมนูห้องปฏิบัติการภายนอก" />
    {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C' }}>{error}</div>}
    {tab === 'dashboard' && <>
      <div className="eq-grid">{[['ห้องปฏิบัติการที่ส่งต่อ', overview.summary.laboratories], ['บริการที่เปิด', overview.summary.services], ['ใกล้หมดอายุ', overview.summary.expiring], ['หมดอายุ', overview.summary.expired], ['ไม่มีใบปัจจุบัน', overview.summary.missingCurrentCertificate]].map(([label, count]) => <div key={String(label)} style={card}><div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{count}</div></div>)}</div>
      <section style={card}><h2 style={{ marginTop: 0, fontSize: 17 }}>ใบรับรองที่ต้องติดตาม</h2>{alertCerts.length === 0 ? <p style={{ color: 'var(--muted)' }}>ไม่มีรายการแจ้งเตือน</p> : <div className="eq-scroll"><table className="eq-table"><thead><tr><th>ห้องปฏิบัติการ</th><th>มาตรฐาน</th><th>หมดอายุ</th><th>ระดับ</th></tr></thead><tbody>{alertCerts.map(cert => <tr key={cert.id}><td>{labName.get(cert.laboratory_id)}</td><td>{cert.standard_name}</td><td>{fmt(cert.expires_on)}</td><td><span className="eq-badge">{urgencyLabel[cert.urgency]}</span></td></tr>)}</tbody></table></div>}</section>
      {laboratoriesWithoutCurrentCertificate.length > 0 && <section className="outlab-missing-certificate" aria-labelledby="outlab-missing-certificate-title"><div className="outlab-missing-certificate-head"><div className="outlab-missing-certificate-icon"><Icon name="alert" size={19} /></div><div className="outlab-missing-certificate-copy"><div className="outlab-missing-certificate-title-row"><h2 id="outlab-missing-certificate-title">ห้องปฏิบัติการที่ไม่มีใบรับรองปัจจุบัน</h2><span className="outlab-missing-certificate-count">{laboratoriesWithoutCurrentCertificate.length} แห่ง</span></div><p>ตรวจสอบและบันทึกใบรับรองใหม่เพื่อให้ข้อมูลผู้ให้บริการครบถ้วน</p></div><Link href="/staff/outlab/certificates" scroll={false} className="outlab-missing-certificate-action">ไปยังใบรับรอง <Icon name="arrowRight" size={15} /></Link></div><div className="outlab-missing-certificate-list" role="list">{laboratoriesWithoutCurrentCertificate.map(lab => <div key={lab.id} className="outlab-missing-certificate-item" role="listitem"><span className="outlab-missing-certificate-lab-icon"><Icon name="building" size={16} /></span><span className="outlab-missing-certificate-lab-copy"><strong>{lab.name}</strong><small>{OUTLAB_SECTOR_LABEL[lab.sector]}{lab.brand ? ` · ${lab.brand}` : ''}</small></span><span className="outlab-missing-certificate-status">รอใบรับรอง</span></div>)}</div></section>}
    </>}

    {tab === 'laboratories' && <>
      {canEdit && <form style={card} onSubmit={event => { event.preventDefault(); const f = event.currentTarget; const d = new FormData(f); submit('/api/admin/outlab/laboratories', { sector: d.get('sector'), name: d.get('name'), brand: d.get('brand') || null, address: d.get('address') || null, contactName: d.get('contactName') || null, contactPhone: d.get('contactPhone') || null, contactEmail: d.get('contactEmail') || null, publicAccreditationSummary: d.get('publicAccreditationSummary') || null, active: true, publishPublic: d.get('publishPublic') === 'on', remark: d.get('remark') || null, ownerIds: d.get('primaryOwnerId') ? [d.get('primaryOwnerId')] : [], primaryOwnerId: d.get('primaryOwnerId') || null }, f) }}><h2 style={{ marginTop: 0, fontSize: 17 }}>เพิ่มห้องปฏิบัติการ</h2><div className="eq-form"><label style={field}>ชื่อ<input name="name" required style={input} /></label><label style={field}>ประเภท<select name="sector" style={input}><option value="gov">ภาครัฐ</option><option value="priv">เอกชน</option><option value="other">อื่น ๆ</option></select></label><label style={field}>หน่วยงาน<input name="brand" style={input} /></label><label style={field}>ผู้รับผิดชอบ<select name="primaryOwnerId" style={input}><option value="">—</option>{overview.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label style={field}>โทรศัพท์<input name="contactPhone" style={input} /></label><label style={field}>อีเมล<input name="contactEmail" type="email" style={input} /></label><label style={field}>ที่อยู่<input name="address" style={input} /></label><label style={field}>มาตรฐานสำหรับเผยแพร่<input name="publicAccreditationSummary" style={input} /></label><label style={{ display: 'flex', gap: 7, alignItems: 'center', minHeight: 38 }}><input name="publishPublic" type="checkbox" /> แสดงในคู่มือสาธารณะ</label><button style={button}>บันทึกห้องปฏิบัติการ</button></div></form>}
      <section style={card}><div className="eq-scroll"><table className="eq-table"><thead><tr><th>ชื่อ</th><th>ประเภท</th><th>ติดต่อ</th><th>ผู้รับผิดชอบ</th><th>เผยแพร่</th><th>สถานะ</th>{canEdit && <th>จัดการ</th>}</tr></thead><tbody>{overview.laboratories.map(lab => <tr key={lab.id}><td><strong>{lab.name}</strong><br /><span style={{ color: 'var(--muted)' }}>{lab.brand}</span></td><td>{OUTLAB_SECTOR_LABEL[lab.sector]}</td><td>{lab.contact_phone || '—'}<br />{lab.contact_email}</td><td>{overview.people.find(p => p.id === lab.primaryOwnerId)?.name ?? '—'}</td><td>{lab.publish_public ? 'ใช่' : 'ไม่'}</td><td>{lab.active ? 'ใช้งาน' : 'ปิด'}</td>{canEdit && <td><div style={{ display: 'flex', gap: 6 }}><button type="button" style={{ ...button, minHeight: 28, padding: '0 9px', fontSize: 11 }} onClick={() => editLaboratory(lab)}>แก้ไข</button>{lab.active && <button type="button" style={{ ...button, minHeight: 28, padding: '0 9px', fontSize: 11, background: '#B45309' }} onClick={() => deactivate(`/api/admin/outlab/laboratories/${lab.id}`, `ปิดใช้งาน ${lab.name}`)}>ปิดใช้งาน</button>}</div></td>}</tr>)}</tbody></table></div></section>
    </>}

    {tab === 'services' && <>
      {canEdit && <form style={card} onSubmit={event => { event.preventDefault(); const f = event.currentTarget; const d = new FormData(f); const test = availableOutlabCatalogTests.find(t => String(t.id) === d.get('testId')); if (!test) { setError('กรุณาเลือกรายการจาก Catalog ที่ยังไม่มีบริการส่งต่อ'); return } submit('/api/admin/outlab/services', { laboratoryId: d.get('laboratoryId'), testId: test.id, manualTestName: null, testNameSnapshot: `${test.code} ${test.th}`, externalCode: d.get('externalCode') || null, method: d.get('method') || null, specimen: d.get('specimen') || null, transportCondition: d.get('transportCondition') || null, tatText: d.get('tatText') || null, price: d.get('price') ? Number(d.get('price')) : null, isPrimary: d.get('isPrimary') === 'on', active: true, remark: null }, f) }}><h2 style={{ marginTop: 0, fontSize: 17 }}>เพิ่มบริการส่งต่อ</h2><div className="eq-form"><label style={field}>ห้องปฏิบัติการ<select name="laboratoryId" required style={input}><option value="">เลือก</option>{overview.laboratories.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label style={field}>รายการจาก Catalog<select required name="testId" style={input} onChange={event => autofillCatalogService(event.currentTarget.form, event.currentTarget.value)}><option value="">เลือก</option>{availableOutlabCatalogTests.map(t => <option key={t.id} value={t.id}>{t.code} · {t.th}</option>)}</select></label><label style={field}>รหัส E-Phis<input name="ephisCode" style={input} onChange={event => autofillCatalogService(event.currentTarget.form, event.currentTarget.value, 'code')} /></label><label style={field}>รหัสภายนอก<input name="externalCode" style={input} /></label><label style={field}>วิธีตรวจ<input name="method" style={input} /></label><label style={field}>สิ่งส่งตรวจ<input name="specimen" style={input} /></label><label style={field}>การขนส่ง<input name="transportCondition" style={input} /></label><label style={field}>TAT<input name="tatText" style={input} /></label><label style={field}>ราคา<input name="price" type="number" min="0" step="0.01" style={input} /></label><label style={{ display: 'flex', gap: 7, alignItems: 'center' }}><input name="isPrimary" type="checkbox" /> ห้องหลัก</label><button style={button}>บันทึกบริการ</button></div></form>}
      <section style={card}><div className="eq-scroll"><table className="eq-table outlab-services-table"><colgroup>{canEdit ? <><col style={{ width: '23%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '24%' }} /><col style={{ width: '11%' }} /><col style={{ width: '7%' }} /><col style={{ width: '5%' }} /><col style={{ width: '12%' }} /></> : <><col style={{ width: '26%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '27%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} /><col style={{ width: '5%' }} /></>}</colgroup><thead><tr><th>รายการตรวจ</th><th>รหัส E-Phis</th><th>ห้อง</th><th>วิธี / สิ่งส่งตรวจ</th><th>ขนส่ง / TAT</th><th style={{ textAlign: 'right' }}>ราคา</th><th style={{ textAlign: 'center' }}>ห้องหลัก</th>{canEdit && <th>จัดการ</th>}</tr></thead><tbody>{overview.services.map(service => <tr key={service.id}><td><strong>{service.test_name_snapshot}</strong><span className="outlab-service-meta">{service.external_code ? `รหัส N-Health: ${service.external_code}` : 'ไม่มีรหัส N-Health'}</span></td><td className="outlab-service-ephis">{service.test_id == null ? '—' : testCode.get(service.test_id) || '—'}</td><td><strong>{labName.get(service.laboratory_id) || '—'}</strong></td><td><div className="outlab-service-detail">{service.method || '—'}</div><div className="outlab-service-detail">{service.specimen || '—'}</div></td><td><div className="outlab-service-detail">{service.transport_condition || '—'}</div><div className="outlab-service-detail">{service.tat_text || '—'}</div></td><td className="outlab-service-price">{service.price == null ? '—' : `฿${service.price.toLocaleString('th-TH')}`}</td><td className="outlab-service-primary">{service.is_primary ? <span className="outlab-primary-mark" title="ห้องหลัก">✓</span> : <span className="outlab-no-primary">—</span>}</td>{canEdit && <td data-service-action><div className="outlab-service-actions"><button type="button" style={{ ...button, minHeight: 30, padding: '0 10px', fontSize: 11 }} onClick={() => editService(service)}>แก้ไข</button>{service.active && <button type="button" style={{ ...button, minHeight: 30, padding: '0 10px', fontSize: 11, background: '#B45309' }} onClick={() => deactivate(`/api/admin/outlab/services/${service.id}`, `ปิดใช้งานบริการ ${service.test_name_snapshot}`)}>ปิดใช้งาน</button>}</div></td>}</tr>)}</tbody></table></div></section>
    </>}

    {tab === 'certificates' && <>
      {canEdit && <form style={card} onSubmit={event => { event.preventDefault(); const f = event.currentTarget; const d = new FormData(f); submit('/api/admin/outlab/certificates', { laboratoryId: d.get('laboratoryId'), standardName: d.get('standardName'), accreditationBody: d.get('accreditationBody') || null, certificateNo: d.get('certificateNo') || null, scope: d.get('scope') || null, validFrom: d.get('validFrom') || null, expiresOn: d.get('expiresOn'), lifecycle: 'current', supersedesId: d.get('supersedesId') || null, remark: d.get('remark') || null }, f) }}><h2 style={{ marginTop: 0, fontSize: 17 }}>เพิ่ม/ต่ออายุใบรับรอง</h2><div className="eq-form"><label style={field}>ห้องปฏิบัติการ<select name="laboratoryId" required style={input}><option value="">เลือก</option>{overview.laboratories.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label style={field}>มาตรฐาน<input name="standardName" required placeholder="เช่น ISO 15189" style={input} /></label><label style={field}>หน่วยรับรอง<input name="accreditationBody" style={input} /></label><label style={field}>เลขที่ใบ<input name="certificateNo" style={input} /></label><label style={field}>วันเริ่ม<input name="validFrom" type="date" style={input} /></label><label style={field}>วันหมดอายุ<input name="expiresOn" type="date" required style={input} /></label><label style={field}>ต่ออายุจากใบเดิม<select name="supersedesId" style={input}><option value="">—</option>{certs.filter(c => c.lifecycle === 'current').map(c => <option key={c.id} value={c.id}>{labName.get(c.laboratory_id)} · {c.standard_name} · {fmt(c.expires_on)}</option>)}</select></label><label style={field}>ขอบข่าย<input name="scope" style={input} /></label><button style={button}>บันทึกใบรับรอง</button></div></form>}
      <section style={card}><div className="eq-scroll"><table className="eq-table"><thead><tr><th>ห้อง/มาตรฐาน</th><th>เลขที่/หน่วยรับรอง</th><th>ขอบข่าย</th><th>วันมีผล</th><th>สถานะ</th><th>ไฟล์</th>{canEdit && <th>จัดการ</th>}</tr></thead><tbody>{certs.map(cert => <tr key={cert.id}><td><strong>{labName.get(cert.laboratory_id)}</strong><br />{cert.standard_name}</td><td>{cert.certificate_no || '—'}<br />{cert.accreditation_body}</td><td>{cert.scope || '—'}</td><td>{fmt(cert.valid_from)} – {fmt(cert.expires_on)}</td><td>{cert.lifecycle}<br /><span className="eq-badge">{urgencyLabel[cert.urgency]}</span></td><td><CertificateFiles certificate={cert} canEdit={canEdit} refresh={refresh} onView={setPreviewFile} /></td>{canEdit && <td><div style={{ display: 'flex', gap: 6 }}><button type="button" style={{ ...button, minHeight: 28, padding: '0 9px', fontSize: 11 }} onClick={() => editCertificate(cert)}>แก้ไข</button>{cert.lifecycle !== 'revoked' && <button type="button" style={{ ...button, minHeight: 28, padding: '0 9px', fontSize: 11, background: '#B91C1C' }} onClick={() => deactivate(`/api/admin/outlab/certificates/${cert.id}`, `เพิกถอนใบรับรอง ${cert.standard_name}`)}>เพิกถอน</button>}</div></td>}</tr>)}</tbody></table></div></section>
    </>}

    {tab === 'settings' && isAdmin && <section style={card}><h2 style={{ marginTop: 0 }}>ผู้มีสิทธิ์แก้ไข OUTLAB</h2><p style={{ color: 'var(--muted)' }}>Admin แก้ไขได้โดยอัตโนมัติ ผู้รับผิดชอบไม่ได้สิทธิ์แก้ไขจนกว่าจะถูกเพิ่มในรายการนี้</p><div className="eq-grid">{overview.people.map(person => <label key={person.id} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 9 }}><input type="checkbox" checked={editors.includes(person.id)} onChange={async event => { const enabled = event.target.checked; await jsonRequest('/api/admin/outlab/editors', 'PATCH', { userId: person.id, enabled }); setEditors(current => enabled ? [...current, person.id] : current.filter(id => id !== person.id)) }} /> <span>{person.name}<small style={{ display: 'block', color: 'var(--muted)' }}>{person.dept || person.role}</small></span></label>)}</div></section>}
    {editor && <RecordEditDialog title={editor.title} fields={editor.fields} initialValues={editor.initialValues} onSave={editor.onSave} onClose={() => setEditor(null)} />}
    {previewFile && <CertificateFilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
  </div>
}
