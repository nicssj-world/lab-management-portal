'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { AgreementSignatureCanvas } from '@/components/personnel/AnnualAgreementsClient'

type DocumentOption = { id: string; document_code: string; title: string; revision: string | null }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit' }
const primary: React.CSSProperties = { border: 0, borderRadius: 8, background: 'var(--primary)', color: '#fff', padding: '9px 13px', font: 'inherit', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const ghost: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', padding: '8px 11px', font: 'inherit', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }

function fiscalYear() { const date = new Date(); return date.getFullYear() + (date.getMonth() >= 9 ? 544 : 543) }
function isoToday() { return new Date().toISOString().slice(0, 10) }

export function AgreementCampaignManagerClient({ initialCampaigns, documents, canManageCampaigns, canApproveCampaigns }: {
  initialCampaigns: any[]
  documents: DocumentOption[]
  canManageCampaigns: boolean
  canApproveCampaigns: boolean
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [selected, setSelected] = useState<any | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ fiscalYear: fiscalYear(), title: `ข้อตกลงประจำปีงบประมาณ พ.ศ. ${fiscalYear()}`, opensOn: isoToday(), dueOn: `${new Date().getFullYear()}-11-30`, agreementDocumentId: documents.find((d) => d.document_code.includes('27/01'))?.id ?? '', disclosureDocumentId: documents.find((d) => d.document_code.includes('27/02'))?.id ?? '' })
  const [approvalMethod, setApprovalMethod] = useState<'drawn' | 'saved'>('drawn')
  const [approvalSignature, setApprovalSignature] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    const res = await fetch('/api/admin/personnel/agreements/campaigns'); const json = await res.json()
    if (res.ok) setCampaigns(json.data ?? []); else setMessage(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
  }
  const select = async (id: string) => {
    const res = await fetch(`/api/admin/personnel/agreements/campaigns/${id}`); const json = await res.json()
    if (res.ok) setSelected(json.data); else setMessage(json.error ?? 'โหลดรายละเอียดไม่สำเร็จ')
  }
  async function createCampaign() {
    setSaving(true); setMessage(null)
    const res = await fetch('/api/admin/personnel/agreements/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    const json = await res.json(); setSaving(false)
    if (!res.ok) return setMessage(json.error ?? 'สร้างรอบไม่สำเร็จ')
    setShowCreate(false); setMessage('สร้างและเปิดรอบข้อตกลงแล้ว'); await refresh(); select(json.data.id)
  }
  async function exempt(profileId: string) {
    const reason = prompt('ระบุเหตุผลการยกเว้น')
    if (!reason?.trim()) return
    const res = await fetch(`/api/admin/personnel/agreements/campaigns/${selected.campaign.id}/recipients/${profileId}/exempt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) })
    const json = await res.json(); if (!res.ok) return setMessage(json.error ?? 'ยกเว้นไม่สำเร็จ'); await select(selected.campaign.id); await refresh()
  }
  async function approve() {
    if (approvalMethod === 'drawn' && !approvalSignature) return setMessage('กรุณาวาดลายเซ็นผู้รับรอง')
    if (!confirm(`รับรองผู้ที่ลงนามแล้ว ${summary?.signed ?? 0} รายการ\n\nผู้ที่รับรองแล้วจะไม่ถูกนำมารับรองซ้ำ บุคลากรที่ลงนามภายหลังจะเป็นชุดรอรับรองถัดไป\n\nยืนยันลงนามรับรองหรือไม่?`)) return
    setSaving(true); setMessage(null)
    const fd = new FormData(); fd.append('signingMethod', approvalMethod); if (approvalSignature) fd.append('signature', approvalSignature)
    const res = await fetch(`/api/admin/personnel/agreements/campaigns/${selected.campaign.id}/approve`, { method: 'POST', body: fd })
    const json = await res.json(); setSaving(false)
    if (!res.ok) return setMessage(json.error ?? 'รับรองรอบไม่สำเร็จ')
    setApprovalSignature(null); setMessage(json.locked ? 'รับรองรายการสุดท้ายและล็อกรอบข้อตกลงแล้ว' : `รับรองแล้ว ${json.certifiedCount ?? summary?.signed ?? 0} รายการ`); await select(selected.campaign.id); await refresh()
  }
  async function deleteCampaign(campaign: any) {
    if (!confirm(`ลบรอบ “${campaign.title}” ?\nลบได้เฉพาะรอบที่ยังไม่มีผู้ลงนาม`)) return
    setSaving(true); setMessage(null)
    const res = await fetch(`/api/admin/personnel/agreements/campaigns/${campaign.id}`, { method: 'DELETE' })
    const json = await res.json(); setSaving(false)
    if (!res.ok) return setMessage(json.error ?? 'ลบรอบข้อตกลงไม่สำเร็จ')
    if (selected?.campaign.id === campaign.id) setSelected(null)
    setMessage('ลบรอบข้อตกลงแล้ว'); await refresh()
  }

  const summary = selected ? {
    total: selected.recipients.length,
    pending: selected.recipients.filter((r: any) => r.status === 'pending').length,
    signed: selected.recipients.filter((r: any) => r.status === 'completed').length,
    certified: selected.recipients.filter((r: any) => r.status === 'certified').length,
    exempt: selected.recipients.filter((r: any) => r.status === 'exempt').length,
  } : null

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><Link href="/staff/personnel" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="arrowLeft" size={15} /> ทะเบียนบุคลากร</Link><div style={{ flex: 1 }}><div style={{ fontWeight: 750, fontSize: 19 }}>จัดการข้อตกลงประจำปี</div><div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>ติดตามข้อตกลงรักษาความลับและความเป็นกลาง รวมถึงการเปิดเผยกิจกรรม</div></div>{canManageCampaigns && <button onClick={() => setShowCreate((value) => !value)} style={primary}><Icon name="plus" size={15} /> เปิดรอบประจำปี</button>}</div>
    {message && <div style={{ color: message.includes('แล้ว') ? 'var(--success)' : 'var(--danger)', fontSize: 13, fontWeight: 650 }}>{message}</div>}
    {canManageCampaigns && showCreate && <Card padding={20}><div style={{ fontWeight: 700, marginBottom: 14 }}>เปิดรอบข้อตกลงใหม่</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      <label style={{ fontSize: 12.5, fontWeight: 650 }}>ปีงบประมาณ พ.ศ.<input type="number" style={{ ...input, marginTop: 4 }} value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: Number(e.target.value) })} /></label>
      <label style={{ fontSize: 12.5, fontWeight: 650 }}>ชื่อรอบ<input style={{ ...input, marginTop: 4 }} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label style={{ fontSize: 12.5, fontWeight: 650 }}>วันเปิด<input type="date" style={{ ...input, marginTop: 4 }} value={form.opensOn} onChange={(e) => setForm({ ...form, opensOn: e.target.value })} /></label>
      <label style={{ fontSize: 12.5, fontWeight: 650 }}>กำหนดส่ง<input type="date" style={{ ...input, marginTop: 4 }} value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} /></label>
      <label style={{ fontSize: 12.5, fontWeight: 650 }}>เอกสาร Confidentiality + Impartiality<select style={{ ...input, marginTop: 4 }} value={form.agreementDocumentId} onChange={(e) => setForm({ ...form, agreementDocumentId: e.target.value })}><option value="">เลือกเอกสารที่เผยแพร่แล้ว</option>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.document_code} · {doc.title} · Rev. {doc.revision ?? '-'}</option>)}</select></label>
      <label style={{ fontSize: 12.5, fontWeight: 650 }}>เอกสารเปิดเผยกิจกรรม<select style={{ ...input, marginTop: 4 }} value={form.disclosureDocumentId} onChange={(e) => setForm({ ...form, disclosureDocumentId: e.target.value })}><option value="">เลือกเอกสารที่เผยแพร่แล้ว</option>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.document_code} · {doc.title} · Rev. {doc.revision ?? '-'}</option>)}</select></label>
    </div><div style={{ marginTop: 14, display: 'flex', gap: 8 }}><button onClick={createCampaign} disabled={saving} style={primary}>{saving ? 'กำลังสร้าง…' : 'สร้างและเปิดรอบ'}</button><button onClick={() => setShowCreate(false)} style={ghost}>ยกเลิก</button></div></Card>}
    <Card padding={0}><div style={{ padding: '15px 18px', fontWeight: 700 }}>รอบข้อตกลงทั้งหมด</div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ background: 'var(--surface-2)', textAlign: 'left', color: 'var(--muted)', fontSize: 11.5 }}><th style={{ padding: '9px 14px' }}>รอบ</th><th>กำหนดส่ง</th><th>ความคืบหน้า</th><th>สถานะ</th><th /></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '11px 14px', fontWeight: 650 }}>{campaign.title}<div style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--muted)' }}>พ.ศ. {campaign.fiscal_year}</div></td><td>{new Date(campaign.due_on).toLocaleDateString('th-TH')}</td><td>{campaign.counts.certified}/{campaign.counts.total} รับรองแล้ว · {campaign.counts.signed} รอรับรอง · {campaign.counts.pending} ค้าง</td><td>{campaign.status === 'approved' ? 'ปิดรอบแล้ว' : 'เปิดอยู่'}</td><td style={{ padding: 8, whiteSpace: 'nowrap' }}><button onClick={() => select(campaign.id)} style={ghost}>รายละเอียด</button>{canManageCampaigns && campaign.status !== 'approved' && campaign.counts.signed === 0 && campaign.counts.certified === 0 && <button onClick={() => deleteCampaign(campaign)} disabled={saving} style={{ ...ghost, marginLeft: 5, color: 'var(--danger)', borderColor: 'rgba(220,38,38,.25)' }}>ลบรอบ</button>}</td></tr>)}{campaigns.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>ยังไม่มีรอบข้อตกลง</td></tr>}</tbody></table></div></Card>
    {selected && <Card padding={20}><div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}><div><div style={{ fontWeight: 750, fontSize: 16 }}>{selected.campaign.title}</div><div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>เอกสาร {selected.campaign.agreement_document_snapshot.code} และ {selected.campaign.disclosure_document_snapshot.code}</div></div><span style={{ display: 'flex', gap: 6 }}><a href={`/api/admin/personnel/agreements/campaigns/${selected.campaign.id}/report`} style={{ ...ghost, textDecoration: 'none' }}><Icon name="download" size={14} /> รายงาน PDF</a><a href={`/api/admin/personnel/agreements/campaigns/${selected.campaign.id}/report?format=csv`} style={{ ...ghost, textDecoration: 'none' }}>CSV</a></span></div>
      {summary && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(100px,1fr))', gap: 8, margin: '16px 0' }}>{[['ทั้งหมด',summary.total],['ค้าง',summary.pending],['ลงนามแล้ว',summary.signed],['รับรองแล้ว',summary.certified],['ยกเว้น',summary.exempt]].map(([label,value]) => <div key={String(label)} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 10 }}><div style={{ fontSize: 19, fontWeight: 750 }}>{value}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{label}</div></div>)}</div>}
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11.5 }}><th style={{ padding: '8px 5px' }}>บุคลากร</th><th>สถานะ</th><th>เปิดเผยกิจกรรม</th><th /></tr></thead><tbody>{selected.recipients.map((recipient: any) => { const disclosure = selected.disclosures.find((row: any) => row.profile_id === recipient.profile_id); return <tr key={recipient.profile_id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '10px 5px', fontWeight: 650 }}>{recipient.profile?.name ?? recipient.profile_id}<div style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--muted)' }}>{recipient.profile?.position_title ?? '-'}</div></td><td>{recipient.status === 'certified' ? 'รับรองแล้ว' : recipient.status === 'completed' ? 'ลงนามแล้ว' : recipient.status === 'exempt' ? `ยกเว้น: ${recipient.exempt_reason}` : 'ค้าง'}</td><td>{disclosure?.has_activity ? <span style={{ color: 'var(--danger)', fontWeight: 650 }}>{disclosure.activity_name}</span> : disclosure ? 'ไม่มี' : '-'}</td><td style={{ whiteSpace: 'nowrap' }}>{canManageCampaigns && recipient.status === 'pending' && selected.campaign.status === 'open' && <button onClick={() => exempt(recipient.profile_id)} style={ghost}>ยกเว้น</button>}{recipient.evidence_url && <a href={`/api/admin/personnel/agreements/campaigns/${selected.campaign.id}/evidence/${recipient.profile_id}`} target="_blank" rel="noreferrer" style={{ ...ghost, marginLeft: 4, textDecoration: 'none' }}><Icon name="eye" size={13} /></a>}</td></tr> })}</tbody></table></div>
      {canApproveCampaigns && selected.campaign.status === 'open' && summary && <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}><div style={{ fontWeight: 700, marginBottom: 5 }}>การรับรองรวมของหัวหน้ากลุ่มงาน</div>{summary.signed === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>ไม่มีรายการลงนามแล้วที่รอรับรอง</div> : <><div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>จะรับรองเฉพาะผู้ที่มีสถานะ “ลงนามแล้ว” จำนวน {summary.signed} รายการ ผู้ที่รับรองแล้วจะไม่ถูกนำมารับรองซ้ำ</div><div style={{ display: 'flex', gap: 8, marginBottom: 10 }}><button onClick={() => setApprovalMethod('drawn')} style={{ ...ghost, borderColor: approvalMethod === 'drawn' ? 'var(--primary)' : 'var(--border)' }}>วาดลายเซ็น</button><button onClick={() => setApprovalMethod('saved')} style={{ ...ghost, borderColor: approvalMethod === 'saved' ? 'var(--primary)' : 'var(--border)' }}>ใช้ลายเซ็นที่บันทึกไว้</button></div>{approvalMethod === 'drawn' && <AgreementSignatureCanvas onChange={setApprovalSignature} />}<button onClick={approve} disabled={saving} style={{ ...primary, marginTop: 10 }}><Icon name="check" size={14} /> รับรอง {summary.signed} รายการ</button>{summary.pending > 0 && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 9 }}>ยังเหลือ {summary.pending} รายการค้าง</span>}</>}</div>}
    </Card>}
  </div>
}
