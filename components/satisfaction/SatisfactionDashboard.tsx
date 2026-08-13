'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useSurveyRealtime } from '@/lib/hooks/useSurveyRealtime'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import type { SurveyDashboardData } from '@/lib/surveys/aggregates'
import { SatisfactionCharts } from './SatisfactionCharts'
import { SatisfactionInlineError, SatisfactionLoadingState } from './SatisfactionPrimitives'

export function SatisfactionDashboard({ campaigns }: { campaigns: SatisfactionCampaignListItem[] }) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [data, setData] = useState<SurveyDashboardData | null>(null)
  const [loading, setLoading] = useState(Boolean(campaignId))
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!campaignId) return
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/satisfaction/dashboard?campaignId=${encodeURIComponent(campaignId)}`)
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      setData(result.data)
      setLastUpdated(new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date()))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่สำเร็จ') } finally { setLoading(false) }
  }, [campaignId])
  useEffect(() => { void load() }, [load])
  useSurveyRealtime(campaignId || null, load)

  if (campaigns.length === 0) return <Card><div className="satisfaction-dashboard-empty"><div className="satisfaction-dashboard-empty-title">ยังไม่มีข้อมูลสำหรับ dashboard</div><div className="satisfaction-dashboard-empty-hint">สร้างและเปิดรอบเก็บข้อมูลก่อน</div></div></Card>
  return <div className="satisfaction-dashboard"><style>{`.satisfaction-dashboard-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}@media(max-width: 600px){.satisfaction-dashboard-metrics{grid-template-columns:1fr}}`}</style><div className="satisfaction-dashboard-header"><div><h2>ผลสำรวจแบบเรียลไทม์</h2><p>อัปเดตเมื่อมีคำตอบใหม่โดยรับเฉพาะ event แล้วดึง aggregate ซ้ำ</p></div><div className="satisfaction-dashboard-controls"><label>รอบเก็บข้อมูล<select aria-label="เลือกรอบเก็บข้อมูล" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label><span className="satisfaction-live-status" aria-live="polite">{loading ? 'กำลังอัปเดต…' : lastUpdated ? `อัปเดตล่าสุด ${lastUpdated} น.` : 'รอข้อมูล'}</span></div></div>{error && <SatisfactionInlineError message={error} onRetry={() => void load()} />}{loading ? <Card><SatisfactionLoadingState label="กำลังโหลดผลสำรวจ…" rows={4} /></Card> : data ? <><div className="satisfaction-dashboard-metrics"><Metric label="คะแนนรวม" value={data.overall.normalizedPct === null ? '—' : `${data.overall.normalizedPct}%`} /><Metric label="ผลเชิงบวก" value={data.overall.positivePct === null ? '—' : `${data.overall.positivePct}%`} /><Metric label="คำตอบ" value={data.responseCount.toLocaleString('th-TH')} /></div><SatisfactionCharts data={data} /></> : null}</div>
}

function Metric({ label, value }: { label: string; value: string }) { return <Card><div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{label}</div><div style={{ color: 'var(--ink)', fontSize: 25, fontWeight: 800, marginTop: 4 }}>{value}</div></Card> }
