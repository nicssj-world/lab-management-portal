'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useSurveyRealtime, type SurveyRealtimeStatus } from '@/lib/hooks/useSurveyRealtime'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import type { SurveyDashboardData } from '@/lib/surveys/aggregates'
import { SatisfactionCharts } from './SatisfactionCharts'
import { SatisfactionInlineError, SatisfactionLoadingState, SatisfactionStatusBadge } from './SatisfactionPrimitives'

type DashboardResponse = { data: SurveyDashboardData }

const timeLabel = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value))
  : 'ยังไม่มีคำตอบ'

export function SatisfactionDashboard({ campaigns, onResponseCountChange }: { campaigns: SatisfactionCampaignListItem[]; onResponseCountChange?: (campaignId: string, responseCount: number) => void }) {
  const searchParams = useSearchParams()
  const deepLinked = campaigns.find((campaign) => campaign.id === searchParams.get('campaignId'))
  const initial = deepLinked ?? campaigns[0]
  const [fiscalYear, setFiscalYear] = useState<number | null>(initial?.fiscalYear ?? null)
  const [surveyId, setSurveyId] = useState(initial?.surveyId ?? '')
  const [departmentId, setDepartmentId] = useState<number | null>(initial?.departmentId ?? null)
  const [data, setData] = useState<SurveyDashboardData | null>(null)
  const [loadedCampaignId, setLoadedCampaignId] = useState('')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(Boolean(initial))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<SurveyRealtimeStatus>('idle')
  const requestSequence = useRef(0)

  const years = useMemo(() => [...new Set(campaigns.flatMap((campaign) => campaign.fiscalYear === null ? [] : [campaign.fiscalYear]))].sort((a, b) => b - a), [campaigns])
  const surveys = useMemo(() => {
    const rows = campaigns.filter((campaign) => fiscalYear === null || campaign.fiscalYear === fiscalYear)
    return [...new Map(rows.map((campaign) => [campaign.surveyId, { id: campaign.surveyId, label: `${campaign.surveyCode} · ${campaign.surveyTitle}` }])).values()]
  }, [campaigns, fiscalYear])
  const departments = useMemo(() => {
    const rows = campaigns.filter((campaign) => (fiscalYear === null || campaign.fiscalYear === fiscalYear) && campaign.surveyId === surveyId && campaign.departmentId !== null)
    return [...new Map(rows.map((campaign) => [campaign.departmentId, { id: campaign.departmentId as number, label: `${campaign.departmentCode ?? ''} · ${campaign.departmentName ?? 'ไม่ระบุหน่วยงาน'}` }])).values()]
  }, [campaigns, fiscalYear, surveyId])
  const selectedCampaign = campaigns.find((campaign) =>
    campaign.fiscalYear === fiscalYear
    && campaign.surveyId === surveyId
    && campaign.departmentId === departmentId,
  ) ?? null
  const campaignId = selectedCampaign?.id ?? ''

  const chooseFiscalYear = (nextYear: number) => {
    const next = campaigns.find((campaign) => campaign.fiscalYear === nextYear)
    setFiscalYear(nextYear)
    setSurveyId(next?.surveyId ?? '')
    setDepartmentId(next?.departmentId ?? null)
  }

  const chooseSurvey = (nextSurveyId: string) => {
    const next = campaigns.find((campaign) => campaign.fiscalYear === fiscalYear && campaign.surveyId === nextSurveyId)
    setSurveyId(nextSurveyId)
    setDepartmentId(next?.departmentId ?? null)
  }

  const load = useCallback(async (background = false) => {
    if (!campaignId) return
    const sequence = ++requestSequence.current
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')
    const previousCampaign = selectedCampaign?.fiscalYear && selectedCampaign.departmentId
      ? campaigns.find((campaign) =>
        campaign.surveyId === selectedCampaign.surveyId
        && campaign.departmentId === selectedCampaign.departmentId
        && campaign.fiscalYear === selectedCampaign.fiscalYear! - 1,
      )
      : null
    try {
      const currentRequest = fetch(`/api/admin/satisfaction/dashboard?campaignId=${encodeURIComponent(campaignId)}&grouping=month`, { cache: 'no-store' })
      const previousRequest = previousCampaign
        ? fetch(`/api/admin/satisfaction/dashboard?campaignId=${encodeURIComponent(previousCampaign.id)}&grouping=month`, { cache: 'no-store' })
        : null
      const [currentResponse, priorResponse] = await Promise.all([currentRequest, previousRequest])
      const result = await currentResponse.json().catch(() => null) as DashboardResponse | { error?: string } | null
      if (!currentResponse.ok) throw new Error(result && 'error' in result ? result.error : 'โหลดข้อมูลไม่สำเร็จ')
      const prior = priorResponse?.ok ? await priorResponse.json().catch(() => null) as DashboardResponse | null : null
      if (sequence !== requestSequence.current) return
      setData((result as DashboardResponse).data)
      setLoadedCampaignId(campaignId)
      onResponseCountChange?.(campaignId, (result as DashboardResponse).data.responseCount)
      setPreviousValue(prior?.data.overall.normalizedPct ?? null)
      setLastUpdated(new Date().toISOString())
    } catch (caught) {
      if (sequence !== requestSequence.current) return
      setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [campaignId, campaigns, onResponseCountChange, selectedCampaign])

  useEffect(() => { void load(false) }, [load])
  useEffect(() => {
    if (!campaignId) return
    const poll = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(poll)
  }, [campaignId, load])

  const onRealtimeStatus = useCallback((status: SurveyRealtimeStatus) => setRealtimeStatus(status), [])
  const realtimeRefetch = useCallback(() => void load(true), [load])
  useSurveyRealtime(campaignId || null, realtimeRefetch, onRealtimeStatus)

  useEffect(() => {
    if (!campaignId) return
    const params = new URLSearchParams(window.location.search)
    params.set('campaignId', campaignId)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [campaignId])

  if (campaigns.length === 0) return <Card><div className="satisfaction-dashboard-empty"><div className="satisfaction-dashboard-empty-title">ยังไม่มีข้อมูลสำหรับ dashboard</div><div className="satisfaction-dashboard-empty-hint">สร้างและเปิดรอบเก็บข้อมูลก่อน</div></div></Card>

  const visibleData = loadedCampaignId === campaignId ? data : null
  const lowSample = (visibleData?.responseCount ?? 0) < 5
  const delta = visibleData?.overall.normalizedPct !== null && visibleData?.overall.normalizedPct !== undefined && previousValue !== null
    ? Math.round((visibleData.overall.normalizedPct - previousValue) * 100) / 100
    : null
  const target = selectedCampaign?.targetResponseCount
  const progress = target ? Math.round(((visibleData?.responseCount ?? selectedCampaign?.responseCount ?? 0) / target) * 100) : null

  return <section className="satisfaction-dashboard satisfaction-realtime" aria-labelledby="satisfaction-realtime-title">
    <div className="satisfaction-dashboard-header">
      <div><h2 id="satisfaction-realtime-title">ผลสำรวจแบบเรียลไทม์</h2><p>ใช้ข้อมูลคำตอบที่ส่งสำเร็จแล้ว คะแนนตั้งแต่คำตอบแรกจะแสดงพร้อมบริบทจำนวนข้อมูล</p></div>
      <div className="satisfaction-live-cluster" aria-live="polite">
        <span className={`satisfaction-connection is-${realtimeStatus}`}><i />{realtimeStatus === 'connected' ? 'เชื่อมต่อเรียลไทม์' : realtimeStatus === 'connecting' ? 'กำลังเชื่อมต่อ' : realtimeStatus === 'error' ? 'เรียลไทม์ขัดข้อง · ใช้ polling' : 'ใช้ polling สำรอง'}</span>
        <Button size="sm" variant="secondary" icon="clock" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? 'กำลังรีเฟรช…' : 'รีเฟรช'}</Button>
      </div>
    </div>

    <div className="satisfaction-realtime-toolbar" aria-label="ตัวกรองผลสำรวจแบบเรียลไทม์">
      <label><span>ปีงบประมาณ</span><select value={fiscalYear ?? ''} onChange={(event) => chooseFiscalYear(Number(event.target.value))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label><span>แบบสำรวจ</span><select value={surveyId} onChange={(event) => chooseSurvey(event.target.value)}>{surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.label}</option>)}</select></label>
      <label><span>หน่วยงาน</span><select value={departmentId ?? ''} onChange={(event) => setDepartmentId(Number(event.target.value))}>{departments.map((department) => <option key={department.id} value={department.id}>{department.label}</option>)}</select></label>
    </div>

    {selectedCampaign ? <div className="satisfaction-campaign-context"><div><strong>{selectedCampaign.surveyCode} · V{selectedCampaign.versionNumber}</strong><span>{selectedCampaign.departmentName ?? 'ไม่ระบุหน่วยงาน'} · ปีงบประมาณ {selectedCampaign.fiscalYear ?? '—'}</span></div><SatisfactionStatusBadge status={selectedCampaign.effectiveStatus} /></div> : null}
    {error && <SatisfactionInlineError message={error} onRetry={() => void load()} />}
    {loading && !visibleData ? <Card><SatisfactionLoadingState label="กำลังโหลดผลสำรวจ…" rows={4} /></Card> : visibleData && selectedCampaign ? <>
      {lowSample ? <div className="satisfaction-low-sample" role="status"><Icon name="alert" size={15} /><span><strong>ข้อมูลยังน้อย (n &lt; 5)</strong> คะแนนรวมแสดงเพื่อเฝ้าติดตาม แต่ยังไม่ควรสรุปเป็นแนวโน้ม และรายละเอียดกลุ่มย่อยจะถูกซ่อน</span></div> : null}
      <div className="satisfaction-dashboard-metrics">
        <Metric label="คะแนนรวม" value={visibleData.overall.normalizedPct === null ? '—' : `${visibleData.overall.normalizedPct}%`} hint={delta === null ? 'ยังไม่มีผลของปีก่อนที่เทียบได้' : `${delta >= 0 ? '+' : ''}${delta} จุดจากปีก่อน`} tone={visibleData.overall.normalizedPct !== null && selectedCampaign.kpiTarget !== null && visibleData.overall.normalizedPct >= selectedCampaign.kpiTarget ? 'pass' : 'neutral'} />
        <Metric label="ผลเชิงบวก" value={visibleData.overall.positivePct === null ? '—' : `${visibleData.overall.positivePct}%`} hint="สัดส่วนคำตอบระดับบวกตามสูตรเดิม" />
        <Metric label="จำนวนคำตอบ" value={target ? `${visibleData.responseCount.toLocaleString('th-TH')} / ${target.toLocaleString('th-TH')}` : visibleData.responseCount.toLocaleString('th-TH')} hint={progress === null ? 'ยังไม่กำหนดเป้าหมายจำนวนคำตอบ' : `คิดเป็น ${progress}% ของเป้าหมาย`} />
        <Metric label="คำตอบล่าสุด" value={timeLabel(visibleData.behavior?.latestResponseAt)} hint={lastUpdated ? `หน้าตรวจสอบล่าสุด ${timeLabel(lastUpdated)}` : 'ยังไม่ได้ตรวจสอบ'} compact />
        <Metric label="ความคิดเห็นที่ยังไม่ได้ดำเนินการ" value={(visibleData.behavior?.unreadCommentCount ?? 0).toLocaleString('th-TH')} hint={`ความคิดเห็นทั้งหมด ${(visibleData.behavior?.commentCount ?? 0).toLocaleString('th-TH')}`} />
      </div>
      <Card className="satisfaction-campaign-kpi-card">
        <div><span>KPI ของรอบนี้</span><strong>{selectedCampaign.kpiMetricName ?? selectedCampaign.kpiMetricCode ?? 'ต้องกำหนด KPI'}</strong><small>{selectedCampaign.kpiMetricCode ? `Target ≥${selectedCampaign.kpiTarget ?? '—'}% · ${selectedCampaign.kpiPublishedAt ? 'เผยแพร่แล้ว' : selectedCampaign.status === 'closed' ? 'ปิดรอบแล้ว รอเผยแพร่' : 'ยังไม่เผยแพร่'}` : 'รอบนี้ยังปิดหรือเผยแพร่ KPI ไม่ได้'}</small></div>
        {selectedCampaign.kpiMetricCode && selectedCampaign.fiscalYear ? <Link href={`/kpi/dashboard?view=satisfaction&metricCode=${encodeURIComponent(selectedCampaign.kpiMetricCode)}&fiscalYear=${selectedCampaign.fiscalYear}`}>ดูประวัติ KPI <Icon name="arrowRight" size={14} /></Link> : null}
      </Card>
      <SatisfactionCharts data={visibleData} lowSample={lowSample} />
    </> : null}
  </section>
}

function Metric({ label, value, hint, tone = 'neutral', compact = false }: { label: string; value: string; hint: string; tone?: 'neutral' | 'pass'; compact?: boolean }) {
  return <Card className={`satisfaction-realtime-metric is-${tone}${compact ? ' is-compact' : ''}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></Card>
}
