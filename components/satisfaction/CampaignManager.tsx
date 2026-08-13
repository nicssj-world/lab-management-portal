'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SatisfactionCampaignListItem, SatisfactionSurveyListItem } from '@/lib/supabase/types'
import { SatisfactionDialog } from './SatisfactionDialog'
import { SatisfactionInlineError, SatisfactionStatusBadge } from './SatisfactionPrimitives'

type QrState = { name: string; url: string; dataUrl: string }

export function CampaignManager({ campaigns, surveys }: { campaigns: SatisfactionCampaignListItem[]; surveys: SatisfactionSurveyListItem[] }) {
  const router = useRouter()
  const published = useMemo(() => surveys.filter((survey) => survey.latestStatus === 'published' && survey.latestVersionId), [surveys])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [surveyId, setSurveyId] = useState(published[0]?.id ?? '')
  const [onePerDevice, setOnePerDevice] = useState(false)
  const [responseLimit, setResponseLimit] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [qr, setQr] = useState<QrState | null>(null)
  const [qrLoadingId, setQrLoadingId] = useState('')
  const [qrError, setQrError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  const resetMutationState = () => {
    setError('')
    setStatusMessage('')
  }

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const survey = published.find((item) => item.id === surveyId)
    const parsedLimit = responseLimit.trim() ? Number(responseLimit) : null
    if (!survey?.latestVersionId || !name.trim()) { setError('กรุณาเลือกแบบสำรวจและระบุชื่อรอบ'); return }
    if (parsedLimit !== null && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) { setError('จำนวนคำตอบสูงสุดต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป'); return }
    setBusyAction('create'); resetMutationState()
    try {
      const response = await fetch('/api/admin/satisfaction/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surveyId, surveyVersionId: survey.latestVersionId, name: name.trim(), onePerDevice, responseLimit: parsedLimit }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'สร้างรอบไม่สำเร็จ')
      setCreating(false)
      setName('')
      setResponseLimit('')
      setOnePerDevice(false)
      setStatusMessage('สร้างรอบเก็บข้อมูลแล้ว')
      router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'สร้างรอบไม่สำเร็จ') } finally { setBusyAction('') }
  }

  const patch = async (campaignId: string, value: Record<string, unknown>) => {
    setBusyAction(`patch:${campaignId}`); resetMutationState()
    try {
      const response = await fetch(`/api/admin/satisfaction/campaigns/${campaignId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'แก้ไขไม่สำเร็จ')
      setStatusMessage(value.status === 'open' ? 'เปิดรับคำตอบแล้ว' : 'ปิดรอบเก็บข้อมูลแล้ว')
      router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'แก้ไขไม่สำเร็จ') } finally { setBusyAction('') }
  }

  const remove = async (campaign: SatisfactionCampaignListItem) => {
    if (!window.confirm(`ลบรอบ "${campaign.name}" ?\nลบได้เฉพาะรอบที่ยังไม่มีคำตอบ และการลบไม่สามารถย้อนกลับได้`)) return
    setBusyAction(`delete:${campaign.id}`); resetMutationState()
    try {
      const response = await fetch(`/api/admin/satisfaction/campaigns/${campaign.id}`, { method: 'DELETE' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'ลบรอบไม่สำเร็จ')
      setStatusMessage('ลบรอบเก็บข้อมูลแล้ว')
      router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ลบรอบไม่สำเร็จ') } finally { setBusyAction('') }
  }

  const showQr = async (campaign: SatisfactionCampaignListItem) => {
    if (qrLoadingId) return
    setQrLoadingId(campaign.id); setQrError(''); setCopyState('idle')
    try {
      const url = `${window.location.origin}/s/${campaign.publicToken}`
      const dataUrl = await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0F172A', light: '#FFFFFF' } })
      setQr({ name: campaign.name, url, dataUrl })
    } catch (caught) { setQrError(caught instanceof Error ? caught.message : 'สร้าง QR Code ไม่สำเร็จ') } finally { setQrLoadingId('') }
  }

  const closeQr = () => { setQr(null); setQrError(''); setCopyState('idle') }

  const copyLink = async () => {
    if (!qr) return
    try {
      if (!navigator.clipboard) throw new Error('เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ')
      await navigator.clipboard.writeText(qr.url)
      setCopyState('copied')
    } catch { setCopyState('error') }
  }

  const isBusy = Boolean(busyAction)
  return (
    <div className="campaign-manager" aria-busy={isBusy}>
      <div className="campaign-manager-header"><div><h2>รอบเก็บข้อมูลและ QR Code</h2><p>สร้างรอบจากเวอร์ชันที่เผยแพร่แล้วเท่านั้น</p></div><Button size="sm" icon="plus" onClick={() => { setCreating((value) => !value); resetMutationState() }}>{creating ? 'ปิดแบบฟอร์ม' : 'เปิดรอบใหม่'}</Button></div>
      {creating && <form className="campaign-create-panel" onSubmit={create}><div className="campaign-create-grid"><label className="campaign-field">ชื่อรอบ<input className="campaign-field-control" required value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น รอบปีงบประมาณ 2569" /></label><label className="campaign-field">แบบสำรวจ<select className="campaign-field-control" required value={surveyId} onChange={(event) => setSurveyId(event.target.value)}><option value="">เลือกแบบสำรวจ</option>{published.map((survey) => <option key={survey.id} value={survey.id}>{survey.code} · V{survey.latestVersion}</option>)}</select></label><label className="campaign-field">จำนวนคำตอบสูงสุด (ไม่บังคับ)<input className="campaign-field-control" inputMode="numeric" type="number" min={1} value={responseLimit} onChange={(event) => setResponseLimit(event.target.value)} /></label><label className="campaign-checkbox-field"><input type="checkbox" checked={onePerDevice} onChange={(event) => setOnePerDevice(event.target.checked)} /> จำกัดหนึ่งคำตอบต่ออุปกรณ์</label></div>{published.length === 0 && <p className="campaign-prerequisite">เผยแพร่แบบสำรวจอย่างน้อยหนึ่งฉบับก่อนสร้างรอบ</p>}<div className="campaign-create-actions"><Button type="submit" disabled={isBusy || published.length === 0}>{busyAction === 'create' ? 'กำลังสร้าง…' : 'สร้างเป็นฉบับร่าง'}</Button></div></form>}
      {error && <div className="campaign-feedback"><SatisfactionInlineError message={error} /></div>}
      {statusMessage && <div className="campaign-success" aria-live="polite">{statusMessage}</div>}
      {campaigns.length === 0 ? <EmptyState title="ยังไม่มีรอบเก็บข้อมูล" hint="เผยแพร่แบบสำรวจ แล้วสร้างรอบเพื่อรับ QR Code" icon="calendar" /> : <div className="satisfaction-table-wrap"><table className="satisfaction-table satisfaction-campaign-table"><caption className="satisfaction-visually-hidden">รายการรอบเก็บข้อมูล</caption><thead><tr><th scope="col">รอบ / แบบ</th><th scope="col">สถานะ</th><th scope="col">คำตอบ</th><th scope="col">QR และการทำงาน</th></tr></thead><tbody>{campaigns.map((campaign) => { const rowBusy = busyAction === `patch:${campaign.id}` || busyAction === `delete:${campaign.id}`; return <tr key={campaign.id}><td data-label="รอบ / แบบ"><strong>{campaign.name}</strong><div className="satisfaction-secondary-text">{campaign.surveyCode} · V{campaign.versionNumber}</div></td><td data-label="สถานะ"><SatisfactionStatusBadge status={campaign.status} /></td><td data-label="คำตอบ">{campaign.responseCount.toLocaleString('th-TH')}{campaign.responseLimit ? ` / ${campaign.responseLimit.toLocaleString('th-TH')}` : ''}</td><td data-label="QR และการทำงาน"><div className="campaign-row-actions"><Button size="sm" variant="secondary" icon="download" onClick={() => void showQr(campaign)} disabled={Boolean(qrLoadingId) || isBusy} aria-busy={qrLoadingId === campaign.id}>{qrLoadingId === campaign.id ? 'กำลังสร้าง QR…' : 'QR'}</Button>{campaign.status === 'draft' && <Button size="sm" onClick={() => void patch(campaign.id, { status: 'open' })} disabled={isBusy} aria-busy={rowBusy}>{rowBusy ? 'กำลังบันทึก…' : 'เปิดรับ'}</Button>}{campaign.status === 'open' && <Button size="sm" variant="danger" onClick={() => void patch(campaign.id, { status: 'closed' })} disabled={isBusy} aria-busy={rowBusy}>{rowBusy ? 'กำลังบันทึก…' : 'ปิดรอบ'}</Button>}{campaign.responseCount === 0 && <Button size="sm" variant="ghost" icon="trash" onClick={() => void remove(campaign)} disabled={isBusy} aria-busy={busyAction === `delete:${campaign.id}`}>ลบรอบ</Button>}</div></td></tr>})}</tbody></table></div>}
      {qrError && <div className="campaign-feedback"><SatisfactionInlineError message={qrError} /></div>}
      {qr && <SatisfactionDialog labelledBy="campaign-qr-title" onClose={closeQr} className="campaign-qr-dialog"><div className="campaign-qr-content"><h2 id="campaign-qr-title">{qr.name}</h2><p>สแกนเพื่อเปิดแบบสำรวจสาธารณะ</p><img src={qr.dataUrl} alt={`QR Code สำหรับ ${qr.name}`} className="campaign-qr-image" width={300} height={300} /><code>{qr.url}</code><div className="campaign-qr-actions"><a href={qr.dataUrl} download={`${qr.name}-qr.png`}><Button icon="download">ดาวน์โหลด PNG</Button></a><Button variant="secondary" onClick={() => void copyLink()} data-dialog-autofocus>{copyState === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</Button><Button variant="ghost" onClick={closeQr}>ปิด</Button></div>{copyState === 'error' && <div className="campaign-copy-error" role="alert">คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอก URL ด้านบนด้วยตนเอง</div>}</div></SatisfactionDialog>}
      <div className="satisfaction-visually-hidden" aria-live="polite">{copyState === 'copied' ? 'คัดลอกลิงก์แล้ว' : ''}</div>
    </div>
  )
}
