'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import type { PermLevel } from '@/lib/permissions'
import type {
  SatisfactionCampaignListItem,
  SatisfactionSurveyListItem,
} from '@/lib/supabase/types'
import { CampaignManager } from './CampaignManager'
import { SatisfactionDashboard } from './SatisfactionDashboard'
import { SurveyComments } from './SurveyComments'
import { SatisfactionExportActions } from './SatisfactionExportActions'

type Tab = 'overview' | 'surveys' | 'campaigns' | 'comments'

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'overview', label: 'ภาพรวม', icon: 'dash' },
  { id: 'surveys', label: 'แบบสำรวจ', icon: 'clipboard' },
  { id: 'campaigns', label: 'รอบเก็บข้อมูล', icon: 'calendar' },
  { id: 'comments', label: 'ความคิดเห็น', icon: 'inbox' },
]

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
}: {
  level: PermLevel
  actorRole: string
  initialSurveys: SatisfactionSurveyListItem[]
  initialCampaigns: SatisfactionCampaignListItem[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
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
    <main className="satisfaction-page" style={{ padding: 24, minWidth: 0 }}>
      <style>{`
        .satisfaction-page{max-width:1440px;margin:0 auto}
        .satisfaction-hero{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;overflow:hidden;margin-bottom:18px;padding:26px;border:1px solid rgba(13,148,136,.2);border-radius:18px;background:linear-gradient(125deg,rgba(13,148,136,.14),rgba(37,99,235,.08) 54%,var(--card));box-shadow:0 12px 28px rgba(15,118,110,.07)}
        .satisfaction-hero::after{content:"";position:absolute;width:260px;height:260px;right:-100px;top:-135px;border-radius:50%;background:rgba(13,148,136,.12);pointer-events:none}
        .satisfaction-hero-copy,.satisfaction-hero-actions{position:relative;z-index:1}.satisfaction-hero-kicker{display:inline-flex;align-items:center;gap:7px;color:#0F766E;font-size:11px;font-weight:800;letter-spacing:.09em}.satisfaction-hero h1{margin:8px 0 0;color:var(--ink);font-size:clamp(24px,3vw,31px);line-height:1.2}.satisfaction-hero p{max-width:660px;margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.65}.satisfaction-hero-metrics{display:flex;gap:18px;margin-top:18px;flex-wrap:wrap}.satisfaction-hero-metric{min-width:104px;padding-left:12px;border-left:2px solid rgba(13,148,136,.34)}.satisfaction-hero-metric span{display:block;color:var(--muted);font-size:11px}.satisfaction-hero-metric strong{display:block;margin-top:2px;color:var(--ink);font-size:19px;line-height:1.1}
        .satisfaction-tabs{display:flex;gap:5px;overflow-x:auto;padding:5px;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;margin-bottom:20px;scrollbar-width:thin}
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
        @media(max-width: 767px){.satisfaction-page{padding:16px !important}.satisfaction-hero{grid-template-columns:1fr;gap:18px;padding:21px}.satisfaction-hero-actions{display:flex}.satisfaction-hero-actions button{width:100%}.satisfaction-stats{grid-template-columns:1fr}.satisfaction-tabs{margin-inline:-4px}.satisfaction-tab{padding:9px 12px}.satisfaction-table{min-width:640px}}
        @media(prefers-reduced-motion:reduce){.satisfaction-tab,.satisfaction-table tbody tr{transition:none}}
      `}</style>

      <section className="satisfaction-hero">
        <div className="satisfaction-hero-copy"><div className="satisfaction-hero-kicker"><Icon name="clipboard" size={14} /> QUALITY EXPERIENCE</div><h1>แบบสำรวจความพึงพอใจ</h1><p>สร้างแบบสำรวจ เปิดรอบรับคำตอบ และติดตามผลอย่างเป็นระบบ โดยไม่เก็บข้อมูลระบุตัวบุคคล</p><div className="satisfaction-hero-metrics"><div className="satisfaction-hero-metric"><span>รอบที่กำลังเปิด</span><strong>{openCampaigns.length}</strong></div><div className="satisfaction-hero-metric"><span>คำตอบสะสม</span><strong>{totalResponses.toLocaleString('th-TH')}</strong></div><div className="satisfaction-hero-metric"><span>แบบสำรวจ</span><strong>{initialSurveys.length}</strong></div></div></div>
        {canEdit && <div className="satisfaction-hero-actions"><Button icon="plus" onClick={() => setActiveTab('surveys')}>สร้างแบบสำรวจ</Button></div>}
      </section>

      <div role="tablist" aria-label="เมนูแบบสำรวจความพึงพอใจ" className="satisfaction-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`satisfaction-panel-${tab.id}`}
            className="satisfaction-tab"
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <section id={`satisfaction-panel-${activeTab}`} role="tabpanel" tabIndex={0}>
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
              action={canEdit ? <Button size="sm" icon="plus">สร้างใหม่</Button> : undefined}
            />
            {initialSurveys.length === 0 ? (
              <EmptyState title="ยังไม่มีแบบสำรวจ" hint="หลังติดตั้ง SQL จะพบแบบมาตรฐานทั้ง 4 ชุด" icon="clipboard" />
            ) : (
              <div className="satisfaction-table-wrap">
                <table className="satisfaction-table">
                  <thead><tr><th>รหัส / ชื่อแบบสำรวจ</th><th>เวอร์ชัน</th><th>สถานะ</th><th>เผยแพร่เมื่อ</th><th>สิทธิ์</th></tr></thead>
                  <tbody>{initialSurveys.map((survey) => (
                    <tr key={survey.id}>
                      <td><Link href={`/staff/satisfaction/${survey.id}`} style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'none' }}>{survey.code}</Link><div style={{ color: 'var(--muted)', marginTop: 3 }}>{survey.title}</div></td>
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
    </main>
  )
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
