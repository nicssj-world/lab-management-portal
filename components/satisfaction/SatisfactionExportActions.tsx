'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/context/PermissionContext'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import type { AnnualSurveyReport } from '@/lib/surveys/report'

const currentFiscalYear = () => {
  const now = new Date()
  return now.getFullYear() + 543 + (now.getMonth() >= 9 ? 1 : 0)
}
const safeName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!)

export function SatisfactionExportActions({ campaigns, actorRole }: { campaigns: SatisfactionCampaignListItem[]; actorRole: string }) {
  const { canEdit: canEditKpi } = usePermission('KPI')
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear())
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const canExportComments = actorRole === 'Admin' || actorRole === 'Manager'
  const campaign = campaigns.find((item) => item.id === campaignId)

  const fetchReport = async () => {
    const response = await fetch(`/api/admin/satisfaction/reports?campaignId=${encodeURIComponent(campaignId)}&fiscalYear=${fiscalYear}`)
    const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'สร้างรายงานไม่สำเร็จ')
    return result.report as AnnualSurveyReport
  }
  const excel = async () => {
    setBusy('excel'); setError('')
    try {
      const report = await fetchReport()
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
        { รายการ: 'แบบสำรวจ', ค่า: `${report.formCode} ${report.formTitle}` },
        { รายการ: 'เวอร์ชัน', ค่า: report.versionLabel },
        { รายการ: 'ปีงบประมาณ', ค่า: report.fiscalYear },
        { รายการ: 'ช่วงเวลา', ค่า: report.periodLabel },
        { รายการ: 'จำนวนผู้ตอบ', ค่า: report.responseCount },
        { รายการ: 'คะแนนรวม (%)', ค่า: report.overall.normalizedPct },
        { รายการ: 'ผลเชิงบวก (%)', ค่า: report.overall.positivePct },
        { รายการ: 'สูตร', ค่า: report.formula },
      ]), 'สรุป')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.sections.map((section) => ({ หมวด: section.title, คะแนน: section.normalizedPct, ผลเชิงบวก: section.positivePct, จำนวนคำตอบที่ใช้: section.validAnswerCount }))), 'รายหมวด')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([1,2,3,4,5].map((score) => ({ ระดับ: score, จำนวน: report.distribution[score as 1|2|3|4|5] }))), 'การกระจายคะแนน')
      XLSX.writeFile(workbook, `${safeName(report.formCode)}-FY${report.fiscalYear}.xlsx`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ส่งออกไม่สำเร็จ') } finally { setBusy('') }
  }
  const printPdf = async () => {
    setBusy('pdf'); setError('')
    try {
      const report = await fetchReport()
      const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(report.formCode)}</title><style>body{font-family:Sarabun,"Noto Sans Thai",sans-serif;color:#0f172a;margin:32px}h1{font-size:22px}.meta{color:#475569;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><h1>รายงานความพึงพอใจ ปีงบประมาณ ${report.fiscalYear}</h1><p>${escapeHtml(report.formCode)} · ${escapeHtml(report.formTitle)} · ${escapeHtml(report.versionLabel)}</p><p class="meta">${escapeHtml(report.periodLabel)} · ผู้ตอบ ${report.responseCount} ราย</p><h2>คะแนนรวม ${report.overall.normalizedPct ?? '—'}%</h2><p>ผลเชิงบวก ${report.overall.positivePct ?? '—'}%</p><table><thead><tr><th>หมวด</th><th>คะแนน</th><th>ผลเชิงบวก</th><th>n</th></tr></thead><tbody>${report.sections.map((section) => `<tr><td>${escapeHtml(section.title)}</td><td>${section.normalizedPct ?? '—'}%</td><td>${section.positivePct ?? '—'}%</td><td>${section.validAnswerCount}</td></tr>`).join('')}</tbody></table><p class="meta">สูตร: ${escapeHtml(report.formula)}</p><script>window.onload=()=>window.print()</script></body></html>`
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'สร้าง PDF ไม่สำเร็จ') } finally { setBusy('') }
  }
  const exportComments = async () => {
    setBusy('comments'); setError('')
    try {
      const response = await fetch(`/api/admin/satisfaction/comments/export?campaignId=${encodeURIComponent(campaignId)}`)
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'ส่งออกความคิดเห็นไม่สำเร็จ')
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.comments.map((comment: any) => ({ วันที่: comment.created_at, คำถาม: comment.survey_questions?.prompt ?? '', ความคิดเห็น: comment.text_value, สถานะ: comment.comment_read_at ? 'อ่านแล้ว' : 'ยังไม่อ่าน' }))), 'ความคิดเห็น')
      XLSX.writeFile(workbook, `${safeName(campaign?.name ?? 'comments')}-comments.xlsx`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ส่งออกความคิดเห็นไม่สำเร็จ') } finally { setBusy('') }
  }
  const publishKpi = async () => {
    if (!campaign || !confirm(`ยืนยันเผยแพร่คะแนนของ “${campaign.name}” ไปยัง KPI ปี ${fiscalYear}?`)) return
    const metricCode = prompt('รหัส KPI (ต้องไม่ซ้ำกับปีเดียวกัน)', `survey_${campaign.surveyCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
    if (!metricCode) return
    setBusy('kpi'); setError('')
    try {
      const response = await fetch(`/api/admin/satisfaction/campaigns/${campaign.id}/publish-kpi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fiscalYear, metricCode, metricName: `ความพึงพอใจ ${campaign.surveyTitle}` }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'เผยแพร่ KPI ไม่สำเร็จ')
      alert('เผยแพร่ KPI เรียบร้อยแล้ว')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'เผยแพร่ KPI ไม่สำเร็จ') } finally { setBusy('') }
  }

  if (campaigns.length === 0) return null
  return <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', marginBottom: 14 }}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><select aria-label="เลือกรอบสำหรับรายงาน" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} style={{ minHeight: 34, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', padding: '0 9px', font: 'inherit', fontSize: 12 }}>{campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="ปีงบประมาณ" type="number" inputMode="numeric" value={fiscalYear} onChange={(event) => setFiscalYear(Number(event.target.value))} style={{ width: 100, minHeight: 34, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', padding: '0 9px', font: 'inherit' }} /><Button size="sm" variant="secondary" icon="download" onClick={excel} disabled={Boolean(busy)}>{busy === 'excel' ? 'กำลังสร้าง…' : 'Excel'}</Button><Button size="sm" variant="secondary" icon="doc" onClick={printPdf} disabled={Boolean(busy)}>{busy === 'pdf' ? 'กำลังสร้าง…' : 'พิมพ์ / PDF'}</Button>{canExportComments && <Button size="sm" variant="secondary" icon="inbox" onClick={exportComments} disabled={Boolean(busy)}>ความคิดเห็น</Button>}{canEditKpi && campaign?.status === 'closed' && <Button size="sm" icon="chart" onClick={publishKpi} disabled={Boolean(busy)}>เผยแพร่ KPI</Button>}</div>{error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 9 }}>{error}</div>}</div>
}
