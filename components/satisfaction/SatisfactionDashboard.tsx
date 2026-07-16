'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useSurveyRealtime } from '@/lib/hooks/useSurveyRealtime'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import type { SurveyDashboardData } from '@/lib/surveys/aggregates'
import { SatisfactionCharts } from './SatisfactionCharts'

export function SatisfactionDashboard({ campaigns }: { campaigns: SatisfactionCampaignListItem[] }) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [data, setData] = useState<SurveyDashboardData | null>(null)
  const [loading, setLoading] = useState(Boolean(campaignId))
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!campaignId) return
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/satisfaction/dashboard?campaignId=${encodeURIComponent(campaignId)}`)
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      setData(result.data)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่สำเร็จ') } finally { setLoading(false) }
  }, [campaignId])
  useEffect(() => { void load() }, [load])
  useSurveyRealtime(campaignId || null, load)

  if (campaigns.length === 0) return <Card><EmptyState title="ยังไม่มีข้อมูลสำหรับ dashboard" hint="สร้างและเปิดรอบเก็บข้อมูลก่อน" icon="chart" /></Card>
  return <div><style>{`.satisfaction-dashboard-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}@media(max-width: 600px){.satisfaction-dashboard-metrics{grid-template-columns:1fr}}`}</style><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, color: 'var(--ink)', fontSize: 16 }}>ผลสำรวจแบบเรียลไทม์</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>อัปเดตเมื่อมีคำตอบใหม่โดยรับเฉพาะ event แล้วดึง aggregate ซ้ำ</p></div><label style={{ fontSize: 12, color: 'var(--muted)' }}>รอบเก็บข้อมูล<select aria-label="เลือกรอบเก็บข้อมูล" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} style={{ marginLeft: 7, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit' }}>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label></div>{loading ? <Card><div style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><Spinner /></div></Card> : error ? <div role="alert" style={{ padding: 12, color: 'var(--danger)', background: 'rgba(220,38,38,.08)', borderRadius: 9 }}>{error}</div> : data ? <><div className="satisfaction-dashboard-metrics"><Metric label="คะแนนรวม" value={data.overall.normalizedPct === null ? '—' : `${data.overall.normalizedPct}%`} /><Metric label="ผลเชิงบวก" value={data.overall.positivePct === null ? '—' : `${data.overall.positivePct}%`} /><Metric label="คำตอบ" value={data.responseCount.toLocaleString('th-TH')} /></div><SatisfactionCharts data={data} /></> : null}</div>
}

function Metric({ label, value }: { label: string; value: string }) { return <Card><div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{label}</div><div style={{ color: 'var(--ink)', fontSize: 25, fontWeight: 800, marginTop: 4 }}>{value}</div></Card> }
