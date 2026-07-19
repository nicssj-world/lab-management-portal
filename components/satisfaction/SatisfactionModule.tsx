'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { SATISFACTION_NAVIGATION } from '@/lib/navigation'
import type { PermLevel } from '@/lib/permissions'
import type {
  SatisfactionCampaignListItem,
  SatisfactionSurveyListItem,
} from '@/lib/supabase/types'
import { CampaignManager } from './CampaignManager'
import { SatisfactionDashboard } from './SatisfactionDashboard'
import { SurveyComments } from './SurveyComments'
import { SatisfactionExportActions } from './SatisfactionExportActions'

export type SatisfactionSection = 'overview' | 'surveys' | 'campaigns' | 'comments'

const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
    : '—'

const statusBadge = (status: string | null) => {
  if (status === 'published' || status === 'open') return <Badge color="green" dot>{status === 'open' ? 'เปิดรับคำตอบ' : 'เผยแพร่แล้ว'}</Badge>
  if (status === 'draft') return <Badge color="amber" dot>ฉบับร่าง</Badge>
  return <Badge color="gray" dot>{status === 'closed' ? 'ปิดแล้ว' : 'เก็บถาวร'}</Badge>
}

export function SatisfactionModule({
  level,
  actorRole,
  initialSurveys,
  initialCampaigns,
  activeSection,
}: {
  level: PermLevel
  actorRole: string
  initialSurveys: SatisfactionSurveyListItem[]
  initialCampaigns: SatisfactionCampaignListItem[]
  activeSection: SatisfactionSection
}) {
  const router = useRouter()
  const activeTab = activeSection
  const [createSurveyOpen, setCreateSurveyOpen] = useState(false)
  const canEdit = level === 'edit'
  const openCampaigns = useMemo(
    () => initialCampaigns.filter((campaign) => campaign.status === 'open'),
    [initialCampaigns],
  )
  const totalResponses = useMemo(
    () => initialCampaigns.reduce((total, campaign) => total + campaign.responseCount, 0),
    [initialCampaigns],
  )

  return (
    <div className="satisfaction-page" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .satisfaction-page{width:100%;max-width:none;margin:0;padding:0;box-sizing:border-box}
        .satisfaction-tabs{display:flex;gap:5px;overflow-x:auto;padding:5px;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;scrollbar-width:thin}
        .satisfaction-tab{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;cursor:pointer;transition:background .18s,color .18s,box-shadow .18s}
        .satisfaction-tab:hover{color:var(--ink);background:color-mix(in srgb,var(--card) 78%,var(--primary-soft))}
        .satisfaction-tab[aria-selected="true"]{color:var(--primary);background:var(--card);box-shadow:0 2px 7px rgba(15,23,42,.08)}
        .satisfaction-tab:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 30%,transparent);outline-offset:2px}
        .satisfaction-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .satisfaction-summary-card{box-shadow:0 7px 18px rgba(15,23,42,.045)}
        .satisfaction-table-wrap{overflow-x:auto}
        .satisfaction-table{width:100%;border-collapse:collapse;min-width:720px}
        .satisfaction-table th{text-align:left;color:var(--muted);font-size:11px;font-weight:800;padding:11px 14px;border-bottom:1px solid var(--border);letter-spacing:.04em;background:color-mix(in srgb,var(--surface-2) 75%,transparent)}
        .satisfaction-table td{padding:14px;border-bottom:1px solid var(--border);font-size:13px;color:var(--ink);vertical-align:middle}
        .satisfaction-campaign-table th:nth-child(n+3),.satisfaction-campaign-table td:nth-child(n+3){text-align:center}
        .satisfaction-status-cell{display:flex;justify-content:center}
        .satisfaction-table tbody tr{transition:background .15s}
        .satisfaction-table tbody tr:hover{background:color-mix(in srgb,var(--surface-2) 76%,transparent)}
        .satisfaction-section-heading{padding:17px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
        @media(max-width: 767px){.satisfaction-stats{grid-template-columns:1fr}.satisfaction-tabs{margin-inline:-4px}.satisfaction-tab{padding:9px 12px}.satisfaction-table{min-width:640px}}
        @media(prefers-reduced-motion:reduce){.satisfaction-tab,.satisfaction-table tbody tr{transition:none}}
      `}</style>

      <PageHeader
        eyebrow="SATISFACTION SURVEY"
        title="แบบสำรวจความพึงพอใจ"
        subtitle="สร้างแบบสำรวจ เปิดรอบรับคำตอบ และติดตามผล โดยไม่เก็บข้อมูลระบุตัวบุคคล"
        actions={canEdit ? <Button icon="plus" onClick={() => setCreateSurveyOpen(true)}>สร้างแบบสำรวจ</Button> : undefined}
        marginBottom={0}
      />

      <ModuleSubnav items={SATISFACTION_NAVIGATION} label="เมนูแบบสำรวจความพึงพอใจ" />

      <section id={`satisfaction-section-${activeTab}`}>
        {activeTab === 'overview' && (
          <>
            <SatisfactionExportActions campaigns={initialCampaigns} actorRole={actorRole} />
            <div className="satisfaction-stats">
              <SummaryCard label="แบบสำรวจทั้งหมด" value={initialSurveys.length} hint="รวมฉบับร่างและเผยแพร่" icon="clipboard" color="#0F766E" />
              <SummaryCard label="รอบที่กำลังเปิด" value={openCampaigns.length} hint="รับคำตอบแบบเรียลไทม์" icon="calendar" color="#2563EB" />
              <SummaryCard label="คำตอบสะสม" value={totalResponses.toLocaleString('th-TH')} hint="ไม่เก็บชื่อหรือ HN" icon="chart" color="#7C3AED" />
            </div>
            <SatisfactionDashboard campaigns={initialCampaigns} />
            <Card padding={0}>
              <SectionHeading title="รอบเก็บข้อมูลล่าสุด" hint="สถานะและจำนวนคำตอบของแต่ละรอบ" />
              <CampaignTable campaigns={initialCampaigns.slice(0, 5)} />
            </Card>
          </>
        )}

        {activeTab === 'surveys' && (
          <Card padding={0}>
            <SectionHeading
              title="แบบสำรวจ"
              hint="แบบที่เผยแพร่แล้วจะถูกล็อกและแก้ไขผ่านเวอร์ชันใหม่"
            />
            {initialSurveys.length === 0 ? (
              <EmptyState title="ยังไม่มีแบบสำรวจ" hint="หลังติดตั้ง SQL จะพบแบบมาตรฐานทั้ง 4 ชุด" icon="clipboard" />
            ) : (
              <div className="satisfaction-table-wrap">
                <table className="satisfaction-table">
                  <thead><tr><th>ชื่อแบบสำรวจ / รหัส</th><th>เวอร์ชัน</th><th>สถานะ</th><th>เผยแพร่เมื่อ</th><th>สิทธิ์</th></tr></thead>
                  <tbody>{initialSurveys.map((survey) => (
                    <tr key={survey.id}>
                      <td><Link href={`/staff/satisfaction/${survey.id}`} style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'none' }}>{survey.title}</Link><div style={{ color: 'var(--muted)', marginTop: 3, fontSize: 12 }}>{survey.code}</div></td>
                      <td>Version {survey.latestVersion ?? '—'}</td>
                      <td>{statusBadge(survey.latestStatus)}</td>
                      <td>{dateLabel(survey.publishedAt)}</td>
                      <td><Badge color={canEdit ? 'blue' : 'gray'}>{canEdit ? 'แก้ไขได้' : 'ดูเท่านั้น'}</Badge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'campaigns' && (
          <Card padding={0}>
            {canEdit ? <CampaignManager campaigns={initialCampaigns} surveys={initialSurveys} /> : <><SectionHeading title="รอบเก็บข้อมูล" hint="แต่ละรอบผูกกับเวอร์ชันและ QR token ของตนเอง" /><CampaignTable campaigns={initialCampaigns} /></>}
          </Card>
        )}

        {activeTab === 'comments' && (
          <Card padding={0}>
            <SurveyComments actorRole={actorRole} campaigns={initialCampaigns} />
          </Card>
        )}
      </section>
      {createSurveyOpen && <CreateSurveyDialog onClose={() => setCreateSurveyOpen(false)} onCreated={(surveyId) => router.push(`/staff/satisfaction/${surveyId}`)} />}
    </div>
  )
}

function CreateSurveyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (surveyId: string) => void }) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const createSurvey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/admin/satisfaction/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, title, description: description.trim() || null }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.surveyId) throw new Error(result.error ?? 'สร้างแบบสำรวจไม่สำเร็จ')
      onCreated(result.surveyId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'สร้างแบบสำรวจไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  const content = (
    <div className="modal-scrim" role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(3px)' }}>
      <section className="modal-panel-pop" role="dialog" aria-modal="true" aria-labelledby="create-survey-title" style={{ width: 'min(520px,100%)', border: '1px solid var(--border)', borderRadius: 16, background: 'var(--card)', boxShadow: '0 24px 80px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <form onSubmit={createSurvey}>
          <div style={{ padding: 20 }}>
            <h2 id="create-survey-title" style={{ margin: 0, color: 'var(--ink)', fontSize: 18 }}>สร้างแบบสำรวจใหม่</h2>
            <p style={{ margin: '7px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>ระบบจะสร้าง Version 1 เป็นฉบับร่าง แล้วเปิดหน้าสำหรับเพิ่มคำถามให้ทันที</p>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <label className="create-survey-field">รหัสแบบสำรวจ<input autoFocus required maxLength={80} value={code} onChange={(event) => setCode(event.target.value)} placeholder="เช่น FM-QP-LAB-09-05" /></label>
              <label className="create-survey-field">ชื่อแบบสำรวจ<input required maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ระบุชื่อแบบสำรวจ" /></label>
              <label className="create-survey-field">คำอธิบาย <span>(ไม่บังคับ)</span><textarea maxLength={4000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="อธิบายกลุ่มผู้ตอบหรือวัตถุประสงค์" /></label>
            </div>
            {error && <div role="alert" style={{ marginTop: 14, padding: '9px 10px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 20px 20px' }}>
            <Button variant="secondary" onClick={onClose} disabled={saving}>ยกเลิก</Button>
            <Button type="submit" icon="plus" disabled={saving}>{saving ? 'กำลังสร้าง…' : 'สร้างและเริ่มแก้ไข'}</Button>
          </div>
        </form>
      </section>
      <style>{`.create-survey-field{display:flex;flex-direction:column;gap:5px;color:var(--muted);font-size:12px;font-weight:700}.create-survey-field span{font-weight:400}.create-survey-field input,.create-survey-field textarea{box-sizing:border-box;width:100%;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);padding:9px 10px;font:inherit;font-size:13px;font-weight:400;resize:vertical}.create-survey-field input:focus-visible,.create-survey-field textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:1px;border-color:var(--primary)}`}</style>
    </div>
  )

  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

function SummaryCard({ label, value, hint, icon, color }: { label: string; value: string | number; hint: string; icon: string; color: string }) {
  return (
    <Card className="satisfaction-summary-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 10, background: `${color}15`, color }}><Icon name={icon} size={19} /></span>
        <div><div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div><div style={{ color: 'var(--ink)', fontSize: 26, lineHeight: 1.2, fontWeight: 800, marginTop: 3 }}>{value}</div><div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 4 }}>{hint}</div></div>
      </div>
    </Card>
  )
}

function SectionHeading({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return <div className="satisfaction-section-heading"><div><h2 style={{ margin: 0, fontSize: 15, color: 'var(--ink)' }}>{title}</h2><p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>{hint}</p></div>{action}</div>
}

function CampaignTable({ campaigns }: { campaigns: SatisfactionCampaignListItem[] }) {
  if (campaigns.length === 0) return <EmptyState title="ยังไม่มีรอบเก็บข้อมูล" hint="สร้างรอบและ QR หลังเผยแพร่แบบสำรวจแล้ว" icon="calendar" />
  return (
    <div className="satisfaction-table-wrap"><table className="satisfaction-table satisfaction-campaign-table"><thead><tr><th>ชื่อรอบ</th><th>แบบ / เวอร์ชัน</th><th>สถานะ</th><th>คำตอบ</th><th>ปิดรับ</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong></td><td>{campaign.surveyCode} · V{campaign.versionNumber}<div style={{ color: 'var(--muted)', marginTop: 3 }}>{campaign.surveyTitle}</div></td><td><div className="satisfaction-status-cell">{statusBadge(campaign.status)}</div></td><td>{campaign.responseCount.toLocaleString('th-TH')}{campaign.responseLimit ? ` / ${campaign.responseLimit.toLocaleString('th-TH')}` : ''}</td><td>{dateLabel(campaign.closesAt)}</td></tr>)}</tbody></table></div>
  )
}
