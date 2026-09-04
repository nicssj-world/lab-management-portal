'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/context/PermissionContext'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import type { AnnualSurveyReport } from '@/lib/surveys/report'

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!)

export function SatisfactionExportActions({ campaigns, actorRole }: { campaigns: SatisfactionCampaignListItem[]; actorRole: string }) {
  const { canEdit: canEditKpi } = usePermission('KPI')
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const canExportComments = actorRole === 'Admin' || actorRole === 'Manager'
  const campaign = campaigns.find((item) => item.id === campaignId)

  const fetchReport = async () => {
    const response = await fetch(`/api/admin/satisfaction/reports?campaignId=${encodeURIComponent(campaignId)}`)
    const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'สร้างรายงานไม่สำเร็จ')
    return result.report as AnnualSurveyReport
  }
  const excel = async () => {
    setBusy('excel'); setError(''); setStatusMessage('')
    try {
      const reportPromise = fetchReport()
      const XLSX = await import('xlsx')
      const report = await reportPromise
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
        { รายการ: 'แบบสำรวจ', ค่า: `${report.formCode} ${report.formTitle}` },
        { รายการ: 'เวอร์ชัน', ค่า: report.versionLabel },
        { รายการ: 'ปีงบประมาณ', ค่า: report.fiscalYear },
        { รายการ: 'ช่วงเวลา', ค่า: report.periodLabel },
        { รายการ: 'จำนวนคำตอบ', ค่า: report.responseCount },
        { รายการ: 'คะแนนรวม (%)', ค่า: report.overall.normalizedPct },
        { รายการ: 'ผลเชิงบวก (%)', ค่า: report.overall.positivePct },
        { รายการ: 'สูตร', ค่า: report.formula },
      ]), 'สรุป')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.sections.map((section) => ({ หมวด: section.title, คะแนน: section.normalizedPct, ผลเชิงบวก: section.positivePct, จำนวนคำตอบที่ใช้: section.validAnswerCount }))), 'รายหมวด')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([1,2,3,4,5].map((score) => ({ ระดับ: score, จำนวน: report.distribution[score as 1|2|3|4|5] }))), 'การกระจายคะแนน')
      XLSX.writeFile(workbook, `${safeName(report.formCode)}-FY${report.fiscalYear}.xlsx`)
      setStatusMessage('ดาวน์โหลดรายงาน Excel แล้ว')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ส่งออกไม่สำเร็จ') } finally { setBusy('') }
  }
  const printPdf = async () => {
    setBusy('pdf'); setError(''); setStatusMessage('')
    try {
      const report = await fetchReport()
      const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(report.formCode)}</title><style>body{font-family:Sarabun,"Noto Sans Thai",sans-serif;color:#0f172a;margin:32px}h1{font-size:22px}.meta{color:#475569;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><h1>รายงานความพึงพอใจ ปีงบประมาณ ${report.fiscalYear}</h1><p>${escapeHtml(report.formCode)} · ${escapeHtml(report.formTitle)} · ${escapeHtml(report.versionLabel)}</p><p class="meta">${escapeHtml(report.periodLabel)} · จำนวนคำตอบ ${report.responseCount}</p><h2>คะแนนรวม ${report.overall.normalizedPct ?? '—'}%</h2><p>ผลเชิงบวก ${report.overall.positivePct ?? '—'}%</p><table><thead><tr><th>หมวด</th><th>คะแนน</th><th>ผลเชิงบวก</th><th>จำนวนคำตอบ</th></tr></thead><tbody>${report.sections.map((section) => `<tr><td>${escapeHtml(section.title)}</td><td>${section.normalizedPct ?? '—'}%</td><td>${section.positivePct ?? '—'}%</td><td>${section.validAnswerCount}</td></tr>`).join('')}</tbody></table><p class="meta">สูตร: ${escapeHtml(report.formula)}</p><script>window.onload=()=>window.print()</script></body></html>`
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setStatusMessage('เปิดหน้าพิมพ์ / PDF แล้ว')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'สร้าง PDF ไม่สำเร็จ') } finally { setBusy('') }
  }
  const exportComments = async () => {
    setBusy('comments'); setError(''); setStatusMessage('')
    try {
      const responsePromise = fetch(`/api/admin/satisfaction/comments/export?campaignId=${encodeURIComponent(campaignId)}`)
      const XLSX = await import('xlsx')
      const response = await responsePromise
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'ส่งออกความคิดเห็นไม่สำเร็จ')
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.comments.map((comment: any) => ({ วันที่: comment.created_at, คำถาม: comment.survey_questions?.prompt ?? '', ความคิดเห็น: comment.text_value, สถานะ: comment.comment_read_at ? 'อ่านแล้ว' : 'ยังไม่อ่าน' }))), 'ความคิดเห็น')
      XLSX.writeFile(workbook, `${safeName(campaign?.name ?? 'comments')}-comments.xlsx`)
      setStatusMessage('ดาวน์โหลดความคิดเห็นแล้ว')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ส่งออกความคิดเห็นไม่สำเร็จ') } finally { setBusy('') }
  }
  const publishKpi = async () => {
    if (!campaign?.fiscalYear || !campaign.kpiMetricCode) { setError('รอบนี้ยังไม่ได้กำหนดปีงบประมาณหรือชุด KPI'); return }
    if (!confirm(`ยืนยันเผยแพร่คะแนนของ “${campaign.name}” ไปยัง ${campaign.kpiMetricName ?? campaign.kpiMetricCode} ปี ${campaign.fiscalYear}?\nผลจากแบบสำรวจจะถูกล็อกไม่ให้แก้ไขจากหน้า KPI`)) return
    setBusy('kpi'); setError(''); setStatusMessage('')
    try {
      const response = await fetch(`/api/admin/satisfaction/campaigns/${campaign.id}/publish-kpi`, { method: 'POST' })
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'เผยแพร่ KPI ไม่สำเร็จ')
      setStatusMessage('เผยแพร่ KPI เรียบร้อยแล้ว')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'เผยแพร่ KPI ไม่สำเร็จ') } finally { setBusy('') }
  }

  if (campaigns.length === 0) return null
  return <div className="satisfaction-overview-actions"><span className="satisfaction-visually-hidden" id="satisfaction-report-actions-label">การส่งออกรายงานและเผยแพร่ KPI</span><div className="satisfaction-export-controls" aria-labelledby="satisfaction-report-actions-label"><label className="satisfaction-export-field">รอบรายงาน<select aria-label="เลือกรอบสำหรับรายงาน" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>{campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{campaign?.fiscalYear ? <span className="satisfaction-export-period">ปีงบประมาณ {campaign.fiscalYear} · {campaign.departmentCode ?? campaign.departmentName}</span> : <span className="satisfaction-export-period is-warning">รอบนี้ยังไม่มีข้อมูลปี/หน่วยงาน</span>}<Button size="sm" variant="secondary" icon="download" onClick={excel} disabled={Boolean(busy) || !campaign?.fiscalYear}>{busy === 'excel' ? 'กำลังสร้าง…' : 'Excel'}</Button><Button size="sm" variant="secondary" icon="doc" onClick={printPdf} disabled={Boolean(busy) || !campaign?.fiscalYear}>{busy === 'pdf' ? 'กำลังสร้าง…' : 'พิมพ์ / PDF'}</Button>{canExportComments && <Button size="sm" variant="secondary" icon="inbox" onClick={exportComments} disabled={Boolean(busy)}>{busy === 'comments' ? 'กำลังสร้าง…' : 'ความคิดเห็น'}</Button>}{canEditKpi && campaign?.status === 'closed' && <Button size="sm" icon="chart" onClick={publishKpi} disabled={Boolean(busy) || !campaign.kpiMetricCode}>{busy === 'kpi' ? 'กำลังเผยแพร่…' : 'เผยแพร่ KPI'}</Button>}</div>{statusMessage && <div className="satisfaction-export-status" aria-live="polite">{statusMessage}</div>}{error && <div className="satisfaction-export-error" role="alert">{error}</div>}</div>
}
