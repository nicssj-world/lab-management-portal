'use client'

import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SatisfactionCampaignListItem, SatisfactionSurveyListItem } from '@/lib/supabase/types'

export function CampaignManager({ campaigns, surveys }: { campaigns: SatisfactionCampaignListItem[]; surveys: SatisfactionSurveyListItem[] }) {
  const published = useMemo(() => surveys.filter((survey) => survey.latestStatus === 'published' && survey.latestVersionId), [surveys])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [surveyId, setSurveyId] = useState(published[0]?.id ?? '')
  const [onePerDevice, setOnePerDevice] = useState(false)
  const [responseLimit, setResponseLimit] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [qr, setQr] = useState<{ name: string; url: string; dataUrl: string } | null>(null)

  const create = async () => {
    const survey = published.find((item) => item.id === surveyId)
    if (!survey?.latestVersionId || !name.trim()) { setError('กรุณาเลือกแบบสำรวจและระบุชื่อรอบ'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/satisfaction/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surveyId, surveyVersionId: survey.latestVersionId, name, onePerDevice, responseLimit: responseLimit ? Number(responseLimit) : null }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'สร้างรอบไม่สำเร็จ')
      window.location.reload()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'สร้างรอบไม่สำเร็จ') } finally { setBusy(false) }
  }

  const patch = async (campaignId: string, value: Record<string, unknown>) => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/satisfaction/campaigns/${campaignId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'แก้ไขไม่สำเร็จ')
      window.location.reload()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'แก้ไขไม่สำเร็จ') } finally { setBusy(false) }
  }

  const showQr = async (campaign: SatisfactionCampaignListItem) => {
    const url = `${window.location.origin}/s/${campaign.publicToken}`
    const dataUrl = await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0F172A', light: '#FFFFFF' } })
    setQr({ name: campaign.name, url, dataUrl })
  }

  return (
    <div className="campaign-manager">
      <style>{`
        .campaign-manager-header{padding:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,color-mix(in srgb,var(--primary-soft) 75%,transparent),transparent)}
        .campaign-create-panel{padding:18px;border-bottom:1px solid var(--border);background:var(--surface-2)}
        .campaign-create-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .campaign-field{display:flex;flex-direction:column;gap:6px;color:var(--muted);font-size:12px;font-weight:700}.campaign-field-control{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid var(--border);border-radius:9px;background:var(--card);color:var(--ink);font:inherit;font-size:13px}.campaign-field-control:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:2px;border-color:var(--primary)}
        .campaign-create-actions{display:flex;justify-content:flex-end;margin-top:14px}.campaign-qr-dialog{width:min(430px,100%);text-align:center}.campaign-qr-image{width:min(300px,100%);border-radius:14px;border:1px solid var(--border);background:#fff}
        @media(max-width:640px){.campaign-manager-header{align-items:flex-start;flex-direction:column}.campaign-manager-header button{width:100%}.campaign-create-grid{grid-template-columns:1fr}.campaign-create-actions button{width:100%}}
      `}</style>
      <div className="campaign-manager-header"><div><h2 style={{ margin: 0, color: 'var(--ink)', fontSize: 16 }}>รอบเก็บข้อมูลและ QR Code</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>สร้างรอบจากเวอร์ชันที่เผยแพร่แล้วเท่านั้น</p></div><Button size="sm" icon="plus" onClick={() => setCreating((value) => !value)}>{creating ? 'ปิดแบบฟอร์ม' : 'เปิดรอบใหม่'}</Button></div>
      {creating && <div className="campaign-create-panel"><div className="campaign-create-grid"><label className="campaign-field">ชื่อรอบ<input className="campaign-field-control" value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น รอบปีงบประมาณ 2569" /></label><label className="campaign-field">แบบสำรวจ<select className="campaign-field-control" value={surveyId} onChange={(event) => setSurveyId(event.target.value)}><option value="">เลือกแบบสำรวจ</option>{published.map((survey) => <option key={survey.id} value={survey.id}>{survey.code} · V{survey.latestVersion}</option>)}</select></label><label className="campaign-field">จำนวนคำตอบสูงสุด (ไม่บังคับ)<input className="campaign-field-control" inputMode="numeric" type="number" min={1} value={responseLimit} onChange={(event) => setResponseLimit(event.target.value)} /></label><label style={{ alignSelf: 'end', minHeight: 42, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink)' }}><input type="checkbox" checked={onePerDevice} onChange={(event) => setOnePerDevice(event.target.checked)} /> จำกัดหนึ่งคำตอบต่ออุปกรณ์</label></div><div className="campaign-create-actions"><Button onClick={create} disabled={busy}>{busy ? 'กำลังสร้าง…' : 'สร้างเป็นฉบับร่าง'}</Button></div></div>}
      {error && <div role="alert" style={{ margin: 14, padding: 10, borderRadius: 8, color: 'var(--danger)', background: 'rgba(220,38,38,.08)' }}>{error}</div>}
      {campaigns.length === 0 ? <EmptyState title="ยังไม่มีรอบเก็บข้อมูล" hint="เผยแพร่แบบสำรวจ แล้วสร้างรอบเพื่อรับ QR Code" icon="calendar" /> : <div className="satisfaction-table-wrap"><table className="satisfaction-table"><thead><tr><th>รอบ / แบบ</th><th>สถานะ</th><th>คำตอบ</th><th>QR และการทำงาน</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong><div style={{ color: 'var(--muted)', marginTop: 3 }}>{campaign.surveyCode} · V{campaign.versionNumber}</div></td><td><Badge color={campaign.status === 'open' ? 'green' : campaign.status === 'draft' ? 'amber' : 'gray'} dot>{campaign.status === 'open' ? 'เปิดรับ' : campaign.status === 'draft' ? 'ฉบับร่าง' : 'ปิดแล้ว'}</Badge></td><td>{campaign.responseCount.toLocaleString('th-TH')}{campaign.responseLimit ? ` / ${campaign.responseLimit.toLocaleString('th-TH')}` : ''}</td><td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Button size="sm" variant="secondary" icon="download" onClick={() => showQr(campaign)}>QR</Button>{campaign.status === 'draft' && <Button size="sm" onClick={() => patch(campaign.id, { status: 'open' })} disabled={busy}>เปิดรับ</Button>}{campaign.status === 'open' && <Button size="sm" variant="danger" onClick={() => patch(campaign.id, { status: 'closed' })} disabled={busy}>ปิดรอบ</Button>}</div></td></tr>)}</tbody></table></div>}
      {qr && <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(15,23,42,.58)', display: 'grid', placeItems: 'center', padding: 16 }}><div role="dialog" aria-modal="true" aria-label={`QR Code ${qr.name}`}><Card className="campaign-qr-dialog"><h2 style={{ margin: 0, color: 'var(--ink)', fontSize: 18 }}>{qr.name}</h2><p style={{ color: 'var(--muted)', fontSize: 12 }}>สแกนเพื่อเปิดแบบสำรวจสาธารณะ</p><img src={qr.dataUrl} alt={`QR Code ${qr.name}`} className="campaign-qr-image" /><div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}><a href={qr.dataUrl} download={`${qr.name}-qr.png`} style={{ textDecoration: 'none' }}><Button icon="download">ดาวน์โหลด PNG</Button></a><Button variant="secondary" onClick={() => navigator.clipboard.writeText(qr.url)}>คัดลอกลิงก์</Button><Button variant="ghost" onClick={() => setQr(null)}>ปิด</Button></div><code style={{ display: 'block', marginTop: 12, padding: 8, borderRadius: 7, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 10, overflowWrap: 'anywhere' }}>{qr.url}</code></Card></div></div>}
    </div>
  )
}
