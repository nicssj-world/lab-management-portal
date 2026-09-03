'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { addLogoToQrDataUrl } from '@/lib/qr-logo'
import type { Department, SatisfactionCampaignListItem, SatisfactionSurveyListItem } from '@/lib/supabase/types'
import { SatisfactionDialog } from './SatisfactionDialog'
import { SatisfactionInlineError, SatisfactionStatusBadge } from './SatisfactionPrimitives'

type QrState = { name: string; url: string; dataUrl: string }
type MetricOption = { code: string; name: string; target: number; isActive: boolean }

function normalizeMetrics(payload: unknown): MetricOption[] {
  const source = payload && typeof payload === 'object' && 'metrics' in payload
    ? (payload as { metrics?: unknown }).metrics
    : payload
  if (!Array.isArray(source)) return []
  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const code = String(row.code ?? row.metric_code ?? '')
    const name = String(row.name ?? row.metric_name ?? '')
    if (!code || !name) return []
    return [{
      code,
      name,
      target: Number(row.target ?? row.target_val ?? 80),
      isActive: Boolean(row.isActive ?? row.is_active ?? true),
    }]
  })
}

export function CampaignManager({ campaigns, surveys }: { campaigns: SatisfactionCampaignListItem[]; surveys: SatisfactionSurveyListItem[] }) {
  const router = useRouter()
  const published = useMemo(() => surveys.filter((survey) => survey.latestStatus === 'published' && survey.latestVersionId), [surveys])
  const [creating, setCreating] = useState(false)
  const [surveyId, setSurveyId] = useState(published[0]?.id ?? '')
  const [fiscalYear, setFiscalYear] = useState(getCurrentThaiFiscalYear())
  const [departmentId, setDepartmentId] = useState('')
  const [kpiMetricCode, setKpiMetricCode] = useState('')
  const [targetResponseCount, setTargetResponseCount] = useState('')
  const [onePerDevice, setOnePerDevice] = useState(false)
  const [responseLimit, setResponseLimit] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [metrics, setMetrics] = useState<MetricOption[]>([])
  const [masterLoading, setMasterLoading] = useState(true)
  const [legacyMetric, setLegacyMetric] = useState<Record<string, string>>({})
  const [editingTargetCampaignId, setEditingTargetCampaignId] = useState('')
  const [targetEditValue, setTargetEditValue] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [qr, setQr] = useState<QrState | null>(null)
  const [qrLoadingId, setQrLoadingId] = useState('')
  const [qrError, setQrError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    let active = true
    setMasterLoading(true)
    Promise.all([
      fetch('/kpi/api/departments', { cache: 'no-store' }).then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.error ?? 'โหลดหน่วยงานไม่สำเร็จ')
        return Array.isArray(result) ? result as Department[] : []
      }),
      fetch('/kpi/api/satisfaction/metrics', { cache: 'no-store' }).then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.error ?? 'โหลดชุด KPI ไม่สำเร็จ')
        return normalizeMetrics(result)
      }),
    ]).then(([departmentRows, metricRows]) => {
      if (!active) return
      const activeDepartments = departmentRows.filter((item) => item.is_active)
      const activeMetrics = metricRows.filter((item) => item.isActive)
      setDepartments(activeDepartments)
      setMetrics(activeMetrics)
      setDepartmentId((value) => value || String(activeDepartments[0]?.id ?? ''))
      setKpiMetricCode((value) => value || activeMetrics[0]?.code || '')
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลตั้งต้นไม่สำเร็จ')
    }).finally(() => {
      if (active) setMasterLoading(false)
    })
    return () => { active = false }
  }, [])

  const selectedDepartment = departments.find((item) => item.id === Number(departmentId))
  const generatedName = selectedDepartment
    ? `รอบปีงบประมาณ ${fiscalYear} (${selectedDepartment.name_th})`
    : `รอบปีงบประมาณ ${fiscalYear}`

  const resetMutationState = () => {
    setError('')
    setStatusMessage('')
  }

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const survey = published.find((item) => item.id === surveyId)
    const parsedLimit = responseLimit.trim() ? Number(responseLimit) : null
    const parsedTarget = targetResponseCount.trim() ? Number(targetResponseCount) : undefined
    if (!survey?.latestVersionId || !departmentId || !kpiMetricCode) {
      setError('กรุณาเลือกแบบสำรวจ หน่วยงาน และชุด KPI ให้ครบ')
      return
    }
    if (parsedLimit !== null && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      setError('จำนวนคำตอบสูงสุดต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป')
      return
    }
    if (parsedTarget !== undefined && (!Number.isInteger(parsedTarget) || parsedTarget < 1)) {
      setError('เป้าหมายจำนวนคำตอบต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป')
      return
    }
    setBusyAction('create'); resetMutationState()
    try {
      const response = await fetch('/api/admin/satisfaction/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          surveyVersionId: survey.latestVersionId,
          fiscalYear,
          departmentId: Number(departmentId),
          targetResponseCount: parsedTarget,
          kpiMetricCode,
          onePerDevice,
          responseLimit: parsedLimit,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'สร้างรอบไม่สำเร็จ')
      setCreating(false)
      setTargetResponseCount('')
      setResponseLimit('')
      setOnePerDevice(false)
      setStatusMessage('สร้างรอบเก็บข้อมูลแล้ว ชื่อรอบและช่วงเวลาถูกกำหนดจากปีงบประมาณอัตโนมัติ')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'สร้างรอบไม่สำเร็จ')
    } finally { setBusyAction('') }
  }

  const patch = async (campaignId: string, value: Record<string, unknown>) => {
    setBusyAction(`patch:${campaignId}`); resetMutationState()
    try {
      const response = await fetch(`/api/admin/satisfaction/campaigns/${campaignId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'แก้ไขไม่สำเร็จ')
      setStatusMessage(value.kpiMetricCode ? 'กำหนด KPI ให้รอบเดิมแล้ว' : value.targetResponseCount !== undefined ? 'อัปเดตเป้าหมายจำนวนคำตอบแล้ว' : value.status === 'open' ? 'เปิดรับคำตอบแล้ว' : 'ปิดรอบเก็บข้อมูลแล้ว')
      if (value.targetResponseCount !== undefined) setEditingTargetCampaignId('')
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
      const dataUrl = await addLogoToQrDataUrl(await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0F172A', light: '#FFFFFF' } }))
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
      <div className="campaign-manager-header"><div><h2>รอบเก็บข้อมูลและ QR Code</h2><p>หนึ่งแบบสำรวจต่อหนึ่งหน่วยงานต่อปีงบประมาณ ชื่อและช่วงเวลาสร้างให้อัตโนมัติ</p></div><Button size="sm" icon="plus" onClick={() => { setCreating((value) => !value); resetMutationState() }}>{creating ? 'ปิดแบบฟอร์ม' : 'เปิดรอบใหม่'}</Button></div>
      {creating && <form className="campaign-create-panel" onSubmit={create}>
        <div className="campaign-generated-name"><span>ชื่อรอบจะสร้างอัตโนมัติ</span><strong>{generatedName}</strong><small>รับคำตอบตั้งแต่ 1 ต.ค. ของปีก่อน ถึงก่อน 1 ต.ค. ของปีงบประมาณที่เลือก</small></div>
        <div className="campaign-create-grid campaign-create-structured-grid">
          <label className="campaign-field">ปีงบประมาณ<input className="campaign-field-control" required type="number" min="2500" max="2999" value={fiscalYear} onChange={(event) => setFiscalYear(Number(event.target.value))} /></label>
          <label className="campaign-field">แบบสำรวจ<select className="campaign-field-control" required value={surveyId} onChange={(event) => setSurveyId(event.target.value)}><option value="">เลือกแบบสำรวจ</option>{published.map((survey) => <option key={survey.id} value={survey.id}>{survey.code} · V{survey.latestVersion} · {survey.title}</option>)}</select></label>
          <label className="campaign-field">หน่วยงาน<select className="campaign-field-control" required value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">เลือกหน่วยงาน</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name_th}</option>)}</select></label>
          <label className="campaign-field">ชุด KPI<select className="campaign-field-control" required value={kpiMetricCode} onChange={(event) => setKpiMetricCode(event.target.value)}><option value="">เลือกชุด KPI</option>{metrics.map((metric) => <option key={metric.code} value={metric.code}>{metric.name} · Target ≥{metric.target}%</option>)}</select></label>
          <label className="campaign-field">เป้าหมายจำนวนคำตอบ <span>(ไม่บังคับ)</span><input className="campaign-field-control" inputMode="numeric" type="number" min={1} value={targetResponseCount} onChange={(event) => setTargetResponseCount(event.target.value)} /><small>ใช้ติดตามความคืบหน้า ไม่หยุดรับคำตอบเมื่อถึงเป้า</small></label>
          <label className="campaign-field">จำนวนคำตอบสูงสุด <span>(ไม่บังคับ)</span><input className="campaign-field-control" inputMode="numeric" type="number" min={1} value={responseLimit} onChange={(event) => setResponseLimit(event.target.value)} /><small>เป็นเพดานรับคำตอบจริง ควรเว้นว่างหากไม่จำเป็น</small></label>
          <label className="campaign-checkbox-field"><input type="checkbox" checked={onePerDevice} onChange={(event) => setOnePerDevice(event.target.checked)} /> จำกัดหนึ่งคำตอบต่ออุปกรณ์</label>
        </div>
        {published.length === 0 && <p className="campaign-prerequisite">เผยแพร่แบบสำรวจอย่างน้อยหนึ่งฉบับก่อนสร้างรอบ</p>}
        {!masterLoading && (departments.length === 0 || metrics.length === 0) && <p className="campaign-prerequisite">ต้องมีหน่วยงานและชุด KPI ที่เปิดใช้งานก่อนสร้างรอบ</p>}
        <div className="campaign-create-actions"><Button type="submit" disabled={isBusy || masterLoading || published.length === 0 || departments.length === 0 || metrics.length === 0}>{busyAction === 'create' ? 'กำลังสร้าง…' : 'สร้างเป็นฉบับร่าง'}</Button></div>
      </form>}
      {error && <div className="campaign-feedback"><SatisfactionInlineError message={error} /></div>}
      {statusMessage && <div className="campaign-success" aria-live="polite">{statusMessage}</div>}
      {campaigns.length === 0 ? <EmptyState title="ยังไม่มีรอบเก็บข้อมูล" hint="เผยแพร่แบบสำรวจ แล้วสร้างรอบเพื่อรับ QR Code" icon="calendar" /> : <div className="satisfaction-table-wrap"><table className="satisfaction-table satisfaction-campaign-table"><caption className="satisfaction-visually-hidden">รายการรอบเก็บข้อมูล</caption><thead><tr><th scope="col">รอบ / แบบ</th><th scope="col">สถานะ</th><th scope="col">จำนวนคำตอบ</th><th scope="col">KPI ของรอบ</th><th scope="col">QR และการทำงาน</th></tr></thead><tbody>{campaigns.map((campaign) => {
        const rowBusy = busyAction === `patch:${campaign.id}` || busyAction === `delete:${campaign.id}`
        const targetProgress = campaign.targetResponseCount ? Math.min(100, Math.round((campaign.responseCount / campaign.targetResponseCount) * 100)) : null
        return <tr key={campaign.id}>
          <td data-label="รอบ / แบบ"><strong>{campaign.name}</strong><div className="satisfaction-secondary-text">{campaign.surveyCode} · V{campaign.versionNumber} · {campaign.departmentCode ?? 'ยังไม่ระบุหน่วยงาน'}</div></td>
          <td data-label="สถานะ"><SatisfactionStatusBadge status={campaign.effectiveStatus} /></td>
          <td data-label="จำนวนคำตอบ"><strong>{campaign.responseCount.toLocaleString('th-TH')}{campaign.targetResponseCount ? ` / ${campaign.targetResponseCount.toLocaleString('th-TH')}` : ''}</strong>{targetProgress !== null ? <div className="campaign-target-progress" aria-label={`ความคืบหน้า ${targetProgress} เปอร์เซ็นต์`}><i style={{ width: `${targetProgress}%` }} /></div> : <div className="satisfaction-secondary-text">ยังไม่กำหนดเป้าหมาย</div>}{campaign.responseLimit ? <small>เพดาน {campaign.responseLimit.toLocaleString('th-TH')}</small> : null}{campaign.status !== 'closed' ? editingTargetCampaignId === campaign.id ? <div className="campaign-target-editor"><input aria-label={`เป้าหมายจำนวนคำตอบของ ${campaign.name}`} type="number" min="1" value={targetEditValue} onChange={(event) => setTargetEditValue(event.target.value)} placeholder="ไม่กำหนด" /><Button size="sm" variant="secondary" disabled={isBusy} onClick={() => void patch(campaign.id, { targetResponseCount: targetEditValue.trim() ? Number(targetEditValue) : null })}>บันทึก</Button><Button size="sm" variant="ghost" onClick={() => setEditingTargetCampaignId('')}>ยกเลิก</Button></div> : <button type="button" className="campaign-target-edit-link" onClick={() => { setEditingTargetCampaignId(campaign.id); setTargetEditValue(campaign.targetResponseCount ? String(campaign.targetResponseCount) : '') }}>แก้เป้าหมาย</button> : null}</td>
          <td data-label="KPI ของรอบ">{campaign.kpiMetricCode ? <div className="campaign-kpi-cell"><strong>{campaign.kpiMetricName ?? campaign.kpiMetricCode}</strong><span>Target ≥{campaign.kpiTarget ?? '—'}%</span>{campaign.fiscalYear ? <Link href={`/kpi/dashboard?view=satisfaction&metricCode=${encodeURIComponent(campaign.kpiMetricCode)}&fiscalYear=${campaign.fiscalYear}`}>ดูประวัติ KPI</Link> : null}</div> : <div className="campaign-kpi-required"><strong>ต้องกำหนด KPI</strong><span>รอบเดิมยังรับคำตอบได้ แต่ปิดรอบหรือเผยแพร่ไม่ได้</span><div><select aria-label={`เลือก KPI สำหรับ ${campaign.name}`} value={legacyMetric[campaign.id] ?? ''} onChange={(event) => setLegacyMetric((values) => ({ ...values, [campaign.id]: event.target.value }))}><option value="">เลือกชุด KPI</option>{metrics.map((metric) => <option key={metric.code} value={metric.code}>{metric.name}</option>)}</select><Button size="sm" variant="secondary" disabled={isBusy || !legacyMetric[campaign.id]} onClick={() => void patch(campaign.id, { kpiMetricCode: legacyMetric[campaign.id] })}>กำหนดครั้งเดียว</Button></div></div>}</td>
          <td data-label="QR และการทำงาน"><div className="campaign-row-actions"><Button size="sm" variant="secondary" icon="download" onClick={() => void showQr(campaign)} disabled={Boolean(qrLoadingId) || isBusy} aria-busy={qrLoadingId === campaign.id}>{qrLoadingId === campaign.id ? 'กำลังสร้าง QR…' : 'QR'}</Button>{campaign.status === 'draft' && <Button size="sm" onClick={() => void patch(campaign.id, { status: 'open' })} disabled={isBusy || !campaign.kpiMetricCode} aria-busy={rowBusy}>{rowBusy ? 'กำลังบันทึก…' : 'เปิดรับ'}</Button>}{campaign.status === 'open' && <Button size="sm" variant="danger" onClick={() => void patch(campaign.id, { status: 'closed' })} disabled={isBusy || !campaign.kpiMetricCode} aria-busy={rowBusy}>{rowBusy ? 'กำลังบันทึก…' : 'ปิดรอบ'}</Button>}{campaign.responseCount === 0 && <Button size="sm" variant="ghost" icon="trash" onClick={() => void remove(campaign)} disabled={isBusy} aria-busy={busyAction === `delete:${campaign.id}`}>ลบรอบ</Button>}</div></td>
        </tr>
      })}</tbody></table></div>}
      {qrError && <div className="campaign-feedback"><SatisfactionInlineError message={qrError} /></div>}
      {qr && <SatisfactionDialog labelledBy="campaign-qr-title" onClose={closeQr} className="campaign-qr-dialog"><div className="campaign-qr-content"><h2 id="campaign-qr-title">{qr.name}</h2><p>สแกนเพื่อเปิดแบบสำรวจสาธารณะ</p><img src={qr.dataUrl} alt={`QR Code สำหรับ ${qr.name}`} className="campaign-qr-image" width={300} height={300} /><code>{qr.url}</code><div className="campaign-qr-actions"><a href={qr.dataUrl} download={`${qr.name}-qr.png`}><Button icon="download">ดาวน์โหลด PNG</Button></a><Button variant="secondary" onClick={() => void copyLink()} data-dialog-autofocus>{copyState === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</Button><Button variant="ghost" onClick={closeQr}>ปิด</Button></div>{copyState === 'error' && <div className="campaign-copy-error" role="alert">คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอก URL ด้านบนด้วยตนเอง</div>}</div></SatisfactionDialog>}
      <div className="satisfaction-visually-hidden" aria-live="polite">{copyState === 'copied' ? 'คัดลอกลิงก์แล้ว' : ''}</div>
    </div>
  )
}
