import { supabaseAdmin } from '@/lib/supabase/admin'
import { getContracts } from '@/lib/queries/contracts'
import { getRejectionLogs } from '@/lib/queries/rejection'
import { Icon } from '@/components/ui/Icon'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import Link from 'next/link'


/* ─── helpers ─── */
function fmtMinutes(min: number) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h} hr ${m} min`
  if (h > 0) return `${h} hr`
  return `${m} min`
}

type HeatCell = { dow: number; hour: number; count: number }
type StageRow = { stage: string; avg_minutes: number }
type TatSummaryPayload = {
  kpi?: {
    avg_tat?: number
    avg_total_tat?: number
    avg_total_tat_cut_720?: number
    pct_within_target?: number
    pct_total_within_target?: number
    total_count?: number
    sample_count?: number
    pipeline_avg_phleb_wait?: number
    pipeline_avg_phleb_draw?: number
    avg_phleb_wait?: number
    avg_transport?: number
    avg_lab_stage?: number
  }
  stage_breakdown?: StageRow[]
  heatmap?: HeatCell[]
  phleb_heatmap?: HeatCell[]
}

function tatSummaryCacheKey(year: number, month: number) {
  return ['v2', year, month, '', '', '', '', ''].join('|')
}

async function readCompletedTatSummary(year: number, month: number) {
  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', 'tat-summary')
    .eq('cache_key', tatSummaryCacheKey(year, month))
    .eq('year', year)
    .eq('month', month)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  const payload = (data?.payload as TatSummaryPayload | undefined) ?? null
  if (!payload || payload.kpi?.avg_total_tat_cut_720 != null) return payload

  const avgCut = await computeTotalTatCut720(year, month)
  if (avgCut == null) return payload
  return {
    ...payload,
    kpi: {
      ...payload.kpi,
      avg_total_tat_cut_720: avgCut,
    },
  }
}

async function computeTotalTatCut720(year: number, month: number) {
  const rows: Array<{
    id: number
    ln: string | null
    register_at: string | null
    rslt_at: string | null
    match_confidence: string | null
  }> = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('tat_records')
      .select('id,ln,register_at,rslt_at,match_confidence')
      .eq('year', year)
      .eq('month', month)
      .eq('is_blood_draw', true)
      .range(from, from + 999)

    if (error) return null
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const samples = new Map<string, { registerMs: number | null; rsltMs: number | null; matched: boolean }>()
  for (const row of rows) {
    const key = row.ln?.trim() || String(row.id)
    const sample = samples.get(key) ?? { registerMs: null, rsltMs: null, matched: false }
    if (row.register_at) {
      const registerMs = new Date(row.register_at).getTime()
      if (Number.isFinite(registerMs) && (sample.registerMs == null || registerMs < sample.registerMs)) sample.registerMs = registerMs
    }
    if (row.rslt_at) {
      const rsltMs = new Date(row.rslt_at).getTime()
      if (Number.isFinite(rsltMs) && (sample.rsltMs == null || rsltMs > sample.rsltMs)) sample.rsltMs = rsltMs
    }
    if (row.match_confidence && row.match_confidence !== 'no_match') sample.matched = true
    samples.set(key, sample)
  }

  const values = Array.from(samples.values())
    .filter(sample => sample.matched && sample.registerMs != null && sample.rsltMs != null)
    .map(sample => ((sample.rsltMs as number) - (sample.registerMs as number)) / 60000)
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 720)

  if (values.length === 0) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
}

// แปลง heatmap cells จาก RPC (hourly) → grid [7][6] (4-hour slots)
function rpcHeatmapToGrid(cells: HeatCell[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(6).fill(0))
  for (const c of cells) {
    const slot = Math.min(5, Math.floor(c.hour / 4))
    grid[c.dow][slot] += c.count
  }
  return grid
}

function stageMinutes(stages: StageRow[] | undefined, stage: string, fallback?: number) {
  const value = stages?.find(row => row.stage === stage)?.avg_minutes ?? fallback
  return value && Number.isFinite(value) ? Math.round(value) : null
}

type AuditEntry = {
  id: string | number
  action: string | null
  target: string | null
  detail: string | null
  created_at: string | null
  user_id: string | null
}

function fmtActivityTime(isoStr: string | null) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'เมื่อวาน'
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

function actionDotColor(action: string | null): string {
  const a = action ?? ''
  if (a.startsWith('document.'))                                   return '#0D9488' // teal — เอกสาร
  if (a.startsWith('test.') || a.startsWith('category.'))         return '#1E5FAD' // blue — รายการตรวจ
  if (a.startsWith('equipment.'))                                  return '#EA580C' // orange — เครื่องมือ
  if (a.startsWith('contract.'))                                   return '#7C3AED' // purple — สัญญา
  if (a.startsWith('risk.') || a.startsWith('rejection.'))        return '#DC2626' // red — ความเสี่ยง
  if (a.startsWith('kpi.'))                                        return '#16A34A' // green — KPI
  if (a.includes('news'))                                          return '#D97706' // amber — ข่าวสาร
  return '#64748B' // gray — อื่นๆ
}

export default async function StaffDashboardPage() {
  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // เดือนที่แล้ว
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  const prevMonthLabel = new Date(prevYear, prevMonth - 1, 1)
    .toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  // สองเดือนที่แล้ว (สำหรับ rejection rate change)
  const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1
  const prevPrevYear  = prevMonth === 1 ? prevYear - 1 : prevYear

  // ── ดึงข้อมูลทั้งหมดพร้อมกัน ──
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01T00:00:00`
  const nextMonthStart = prevMonth === 12
    ? `${prevYear + 1}-01-01T00:00:00`
    : `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01T00:00:00`

  const [
    contracts,
    testActiveResult,
    testTotalResult,
    rejMonthResult,
    rejPrevResult,
    tatSummary,
    tatPrevSummary,
    docTotalResult,
    docPublishedResult,
    docNewResult,
    docReviewResult,
    docDraftResult,
    auditLogResult,
  ] = await Promise.all([
    getContracts(supabaseAdmin),
    supabaseAdmin.from('tests').select('*', { count: 'exact', head: true }).eq('active', true),
    supabaseAdmin.from('tests').select('*', { count: 'exact', head: true }),
    getRejectionLogs(supabaseAdmin, { year: prevYear, month: prevMonth, limit: 1 }),
    getRejectionLogs(supabaseAdmin, { year: prevPrevYear, month: prevPrevMonth, limit: 1 }),
    // Read the completed all-month TAT analysis cached by the TAT module.
    readCompletedTatSummary(prevYear, prevMonth),
    readCompletedTatSummary(prevPrevYear, prevPrevMonth),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Published'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', prevMonthStart).lt('created_at', nextMonthStart),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Review'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Draft'),
    supabaseAdmin
      .from('audit_log')
      .select('id, action, target, detail, created_at, user_id')
      .not('action', 'in', '("permission.update","settings.update","user.update","user.create")')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const testCount    = testActiveResult.count ?? 0
  const testTotal    = testTotalResult.count ?? 0
  const rejThisMonth = rejMonthResult.count ?? 0
  const rejPrevMonth = rejPrevResult.count ?? 0
  const docTotal     = docTotalResult.count ?? 0
  const docPublished = docPublishedResult.count ?? 0
  const docNew       = docNewResult.count ?? 0
  const docReview    = docReviewResult.count ?? 0
  const docDraft     = docDraftResult.count ?? 0

  const auditLogs: AuditEntry[] = (auditLogResult.data ?? []) as AuditEntry[]
  const profileMap: Record<string, string> = {}
  const userIds = [...new Set(auditLogs.map(l => l.user_id).filter((id): id is string => !!id))]
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      if (p.id && p.name) profileMap[p.id] = p.name
    }
  }

  const tatData = tatSummary ?? {}
  const kpi     = tatData.kpi ?? {}

  const avgTAT      = Math.round(kpi.avg_total_tat_cut_720 ?? kpi.avg_total_tat ?? kpi.avg_tat ?? 0)
  const pctOnTarget = Math.round(kpi.pct_total_within_target ?? kpi.pct_within_target ?? 0)
  const totalSamples = kpi.sample_count ?? kpi.total_count ?? 0

  const prevKpi        = (tatPrevSummary ?? {})?.kpi ?? {}
  const prevSamples    = prevKpi.sample_count ?? prevKpi.total_count ?? 0
  const rejRate        = totalSamples > 0 ? (rejThisMonth / totalSamples) * 100 : null
  const rejRatePrev    = prevSamples > 0 ? (rejPrevMonth / prevSamples) * 100 : null
  const rejRateChange  = rejRate != null && rejRatePrev != null ? rejRate - rejRatePrev : null
  const avgPhlebWait = stageMinutes(tatData.stage_breakdown, 'รอเจาะเลือด', kpi.pipeline_avg_phleb_wait ?? kpi.avg_phleb_wait)
  const avgPhlebDraw = stageMinutes(tatData.stage_breakdown, 'เจาะเลือด', kpi.pipeline_avg_phleb_draw)
  const avgTransport = stageMinutes(tatData.stage_breakdown, 'ขนส่งตัวอย่าง', kpi.avg_transport)
  const avgLabStage  = stageMinutes(tatData.stage_breakdown, 'วิเคราะห์ในแลป', kpi.avg_lab_stage ?? kpi.avg_tat)

  const phlebHeatmap = rpcHeatmapToGrid(tatData.phleb_heatmap ?? [])
  const tatHeatmap   = rpcHeatmapToGrid(tatData.heatmap ?? [])
  const phlebCount   = (tatData.phleb_heatmap ?? []).reduce((s, c) => s + c.count, 0)
  const tatCount     = (tatData.heatmap ?? []).reduce((s, c) => s + c.count, 0)

  function monthsLeft(endDate: string | null) {
    if (!endDate) return 999
    return Math.floor((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
  }
  const criticalContracts = contracts.filter(c => {
    const ml = monthsLeft(c.end_date)
    const isExpiring = c.total > 10_000_000 ? ml <= 6 : ml <= 3
    const budgetRemaining = c.total > 0 ? ((c.total - c.used) / c.total) * 100 : 100
    return isExpiring || budgetRemaining < 30
  })

  const todayStr = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr  = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  const PIPELINE = [
    { label: 'ยืนยันคิว', from: 'ลงทะเบียน', to: 'ยืนยันคิว', metric: 'รอเจาะเลือดเฉลี่ย', value: avgPhlebWait, icon: 'check', color: '#1E5FAD' },
    { label: 'เจาะเสร็จ', from: 'ยืนยันคิว', to: 'เจาะเสร็จ', metric: 'เจาะเลือดเฉลี่ย', value: avgPhlebDraw, icon: 'syringe', color: '#9333EA' },
    { label: 'รับ Specimen', from: 'เจาะเสร็จ', to: 'รับ Specimen', metric: 'ขนส่งตัวอย่างเฉลี่ย', value: avgTransport, icon: 'cup', color: '#D97706' },
    { label: 'รายงานผล', from: 'รับ Specimen', to: 'รายงานผล', metric: 'วิเคราะห์ในแลปเฉลี่ย', value: avgLabStage, icon: 'chart', color: '#16A34A' },
  ].filter((step): step is { label: string; from: string; to: string; metric: string; value: number; icon: string; color: string } => typeof step.value === 'number' && step.value > 0)

  const DOW_TH = ['อา','จ','อ','พ','พฤ','ศ','ส']
  const SLOTS   = ['00','04','08','12','16','20']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Mono:wght@400;500&display=swap');
        .dmono{font-family:'DM Mono',monospace}
        .ops-title{font-family:'Rajdhani',sans-serif;text-transform:uppercase}
        @keyframes breathe{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,211,238,.45)}50%{opacity:.65;box-shadow:0 0 0 7px rgba(34,211,238,0)}}
        .live-dot{animation:breathe 2.4s ease-in-out infinite}
        .kpi-card{transition:transform .18s ease,box-shadow .18s ease;box-shadow:0 1px 4px rgba(15,23,42,.05),0 4px 16px rgba(15,23,42,.04)}
        .kpi-card:hover{transform:translateY(-3px);box-shadow:0 8px 32px rgba(30,95,173,.14)!important}
        .rej-bar{transition:width .7s cubic-bezier(.22,1,.36,1)}
        .workflow-step{transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
        .workflow-step:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(15,23,42,.08)}
        .hm-cell{transition:transform .1s}
        .hm-cell:hover{transform:scale(1.15)}
        .contract-card{transition:border-color .15s}
        .contract-card:hover{border-color:var(--primary)!important}
        .section-link:hover{background:var(--primary-soft)!important;color:var(--primary)!important}
        .qa-tile{transition:background .15s,border-color .15s}
        .qa-tile:hover{background:var(--primary-soft)!important;border-color:var(--primary)!important}
        .activity-timeline{position:relative}
        .activity-timeline::before{content:'';position:absolute;left:3px;top:18px;bottom:18px;width:1px;background:var(--border);z-index:0}
        .more-link{display:block;text-align:center;font-size:12px;font-weight:600;color:var(--muted);padding:9px 0;border-radius:8px;background:var(--surface-2);transition:all .15s;text-decoration:none}
        .more-link:hover{background:var(--primary-soft);color:var(--primary)}
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

        {/* ══ HERO ══ */}
        <div style={{
          background:'linear-gradient(135deg,#0B1426 0%,#112240 55%,#1E5FAD 100%)',
          borderRadius:18, padding:'22px 28px',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16,
          position:'relative', overflow:'hidden',
        }}>
          {[160,240,320].map((s,i)=>(
            <div key={i} style={{ position:'absolute',right:-40,top:'50%',transform:'translateY(-50%)',width:s,height:s,borderRadius:'50%',border:`1px solid rgba(255,255,255,${.05-i*.01})`,pointerEvents:'none' }}/>
          ))}
          <div style={{ position:'absolute',right:0,top:0,bottom:0,width:'45%',background:'radial-gradient(ellipse at 90% 50%,rgba(30,95,173,.35) 0%,transparent 65%)',pointerEvents:'none' }} />
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:7 }}>
              <span className="live-dot" style={{ width:8,height:8,borderRadius:'50%',background:'#22D3EE',display:'inline-block',flexShrink:0 }} />
              <span style={{ color:'rgba(255,255,255,.45)',fontSize:10.5,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' }}>
                LIVE · {timeStr} · {todayStr}
              </span>
            </div>
            <h1 className="ops-title" style={{ color:'#fff',margin:'0 0 4px',fontSize:28,fontWeight:700,letterSpacing:'.06em',lineHeight:1.05 }}>
              Lab Operations Center
            </h1>
            <p style={{ color:'rgba(255,255,255,.45)',margin:0,fontSize:12.5 }}>
              กลุ่มงานเทคนิคการแพทย์ · โรงพยาบาลชลบุรี
            </p>
          </div>
        </div>

        {/* ══ KPI ROW ══ */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          <KpiCard
            icon="flask" label="รายการตรวจทั้งหมด" accent="#0EA5E9"
            value={testCount.toLocaleString()} sub="รายการที่ใช้งานอยู่"
            barLabel="Active" barValue={`${testCount}/${testTotal}`}
            barPct={testTotal ? (testCount / testTotal) * 100 : 0}
          />
          <KpiCard
            icon="doc" label="เอกสารคุณภาพ" accent="#0D9488"
            value={docTotal.toLocaleString()} sub={prevMonthLabel}
            change={docNew > 0 ? `+${docNew} ฉบับ` : undefined}
            changeDir="up"
            barLabel="Published" barValue={`${docPublished}/${docTotal}`}
            barPct={docTotal > 0 ? (docPublished / docTotal) * 100 : 0}
          />
          <KpiCard
            icon="alert" label="Rejection Rate" accent="#F59E0B"
            value={rejRate != null ? `${rejRate.toFixed(2)}%` : `${rejThisMonth.toLocaleString()} ราย`}
            sub={rejRate != null ? 'เป้าหมาย: <3%' : prevMonthLabel}
            warn={rejRate != null ? rejRate >= 3 : rejThisMonth > 50}
            change={rejRateChange != null ? `${Math.abs(rejRateChange).toFixed(2)}% ${rejRateChange <= 0 ? 'ดีขึ้น' : 'แย่ลง'}` : undefined}
            changeDir={rejRateChange != null ? (rejRateChange <= 0 ? 'down' : 'up') : undefined}
            barLabel="Rate" barValue={rejRate != null ? `${rejRate.toFixed(2)}%` : `${rejThisMonth}`}
            barPct={rejRate != null ? Math.min(100, (rejRate / 3) * 100) : Math.min(100, (rejThisMonth / 200) * 100)}
          />
          <KpiCard
            icon="building" label="สัญญาใกล้หมด/งบต่ำ"
            accent={criticalContracts.length > 0 ? '#DC2626' : '#16A34A'}
            value={criticalContracts.length.toLocaleString()} sub={`จาก ${contracts.length} สัญญา`}
            warn={criticalContracts.length > 0}
            barLabel="ต้องดูแล" barValue={`${criticalContracts.length}/${contracts.length}`}
            barPct={contracts.length ? (criticalContracts.length / contracts.length) * 100 : 0}
          />
        </div>

        {/* ══ ACTIVITY + CONTRACTS ══ */}
        <div style={{ display:'grid', gridTemplateColumns:'7fr 3fr', gap:16, alignItems:'stretch' }}>

          {/* Recent Activity — custom card with timeline */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30,height:30,borderRadius:8,background:'rgba(30,95,173,.14)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--primary)',flexShrink:0 }}>
                  <Icon name="bell" size={14} />
                </div>
                <div>
                  <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>กิจกรรมล่าสุด</div>
                  <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>อัปเดตวันนี้</div>
                </div>
              </div>
              <Link href="/staff/activity" style={{ textDecoration:'none' }}>
                <span style={{ fontSize:12.5,fontWeight:600,color:'var(--primary)',whiteSpace:'nowrap' }}>ดูทั้งหมด →</span>
              </Link>
            </div>
            <div style={{ padding:'8px 20px 16px' }}>
              {auditLogs.length > 0 ? (
                <>
                  <div className="activity-timeline">
                    {auditLogs.slice(0, 7).map((entry, i) => (
                      <ActivityFeedItem
                        key={entry.id}
                        entry={entry}
                        profileName={entry.user_id ? (profileMap[entry.user_id] ?? '') : ''}
                        isLast={i === Math.min(6, auditLogs.length - 1)}
                      />
                    ))}
                  </div>
                  {auditLogs.length > 7 && (
                    <div style={{ marginTop:10 }}>
                      <Link href="/staff/activity" className="more-link">
                        + {auditLogs.length - 7} รายการเพิ่มเติม
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <Empty text="ยังไม่มีกิจกรรมในระบบ" icon="clock" />
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Contracts */}
            <SectionCard title="สัญญาใกล้หมดอายุ/งบต่ำ" sub="งบเหลือ < 30% หรือใกล้หมดอายุ" href="/staff/contracts" hrefLabel="ดูทั้งหมด" icon="building" iconColor="#D97706" plainLink>
              {criticalContracts.length > 0 ? (
                <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
                  {criticalContracts.slice(0, 6).map(c => <ContractCard key={c.id} contract={c} />)}
                </div>
              ) : (
                <Empty text="ไม่มีสัญญาใกล้หมดอายุหรืองบต่ำ" icon="shieldCheck" />
              )}
            </SectionCard>

            {/* Quick Actions + Doc Status */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--ink)' }}>Quick Actions</div>
              </div>
              <div style={{ padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {([
                  { href:'/staff/tests',    icon:'plus',   accent:'#1E5FAD', th:'เพิ่มรายการตรวจ',  en:'Add new test item' },
                  { href:'/staff/documents',icon:'upload',  accent:'#0D9488', th:'Upload เอกสาร',    en:'SOP / WI / Form' },
                  { href:'/staff/rejection',icon:'alert',   accent:'#DC2626', th:'บันทึก Rejection', en:'Log specimen rejection' },
                  { href:'/kpi/dashboard',  icon:'chart',  accent:'#16A34A', th:'รายงาน KPI',        en:'Monthly report' },
                ] as const).map(item => (
                  <Link key={item.href} href={item.href} style={{ textDecoration:'none' }}>
                    <div className="qa-tile" style={{
                      padding:'11px 10px', borderRadius:10,
                      border:'1px solid var(--border)',
                      background:'var(--surface-2)',
                      cursor:'pointer',
                      display:'flex', flexDirection:'column', gap:6,
                    }}>
                      <div style={{ width:28,height:28,borderRadius:7,background:`${item.accent}18`,display:'flex',alignItems:'center',justifyContent:'center',color:item.accent }}>
                        <Icon name={item.icon} size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize:12,fontWeight:700,color:'var(--ink)',lineHeight:1.3 }}>{item.th}</div>
                        <div style={{ fontSize:10.5,color:'var(--muted)',marginTop:2 }}>{item.en}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Document status bars */}
              <div style={{ padding:'0 14px 14px' }}>
                <div style={{ fontSize:10.5,fontWeight:700,color:'var(--muted)',letterSpacing:'.06em',textTransform:'uppercase',marginBottom:10,paddingTop:10,borderTop:'1px solid var(--border)' }}>เอกสารตามสถานะ</div>
                {([
                  { label:'Published', count:docPublished, color:'#16A34A' },
                  { label:'Review',    count:docReview,    color:'#1E5FAD' },
                  { label:'Draft',     count:docDraft,     color:'#D97706' },
                ] as const).map(({ label, count, color }) => {
                  const pct = docTotal > 0 ? Math.round((count / docTotal) * 100) : 0
                  return (
                    <div key={label} style={{ marginBottom:9 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                        <span style={{ fontSize:12,color:'var(--ink)',fontWeight:600 }}>{label}</span>
                        <span style={{ fontSize:12,color,fontWeight:700 }}>{pct}%</span>
                      </div>
                      <div style={{ height:4,background:'var(--border)',borderRadius:99,overflow:'hidden' }}>
                        <div style={{ height:'100%',width:`${pct}%`,background:color,borderRadius:99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ══ PIPELINE ══ */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30,height:30,borderRadius:8,background:'rgba(30,95,173,.14)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--primary)' }}>
              <Icon name="trending" size={14} />
            </div>
            <div>
              <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>Lab Workflow Pipeline</div>
              <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>เวลาเฉลี่ยแต่ละขั้นตอน · {prevMonthLabel}</div>
            </div>
          </div>
          <div style={{ padding:'18px 20px' }}>
            {PIPELINE.length > 0 ? (
              <>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14,overflowX:'auto',paddingBottom:2 }}>
                  {['ลงทะเบียน', ...PIPELINE.map(step => step.to)].map((label, index, arr) => (
                    <div key={`${label}-${index}`} style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
                      <div style={{
                        padding:'5px 10px',
                        borderRadius:999,
                        background:index === 0 ? 'var(--surface-2)' : 'rgba(30,95,173,.08)',
                        border:'1px solid var(--border)',
                        color:index === 0 ? 'var(--muted)' : 'var(--ink)',
                        fontSize:11,
                        fontWeight:800,
                        whiteSpace:'nowrap',
                      }}>
                        {label}
                      </div>
                      {index < arr.length - 1 && <Icon name="chevRight" size={13} style={{ color:'var(--muted)' }} />}
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:0, alignItems:'stretch' }}>
                  {PIPELINE.map((step, i) => (
                    <div key={step.label} style={{ flex:1, display:'flex', alignItems:'center', minWidth:0 }}>
                      <div className="workflow-step" style={{
                        flex:1,
                        padding:'14px 16px',
                        borderRadius:10,
                        background:`linear-gradient(135deg,${step.color}0A 0%,var(--surface-2) 100%)`,
                        border:'1px solid var(--border)',
                        borderLeft:`3px solid ${step.color}`,
                        minWidth:0,
                      }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
                          <div style={{ width:30,height:30,borderRadius:8,background:`${step.color}18`,display:'flex',alignItems:'center',justifyContent:'center',color:step.color,flexShrink:0 }}>
                            <Icon name={step.icon} size={14} />
                          </div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:12.5,fontWeight:800,color:'var(--ink)',lineHeight:1.2 }}>{step.label}</div>
                            <div style={{ fontSize:10,color:'var(--muted)',marginTop:1.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                              {step.from} → {step.to}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize:10.5,color:'var(--muted)',marginBottom:3 }}>{step.metric}</div>
                        <div className="dmono" style={{ fontSize:22,fontWeight:700,color:step.color,lineHeight:1 }}>
                          {fmtMinutes(step.value)}
                        </div>
                      </div>
                      {i < PIPELINE.length - 1 && (
                        <div style={{ padding:'0 8px', color:'var(--muted)', flexShrink:0 }}>
                          <Icon name="chevRight" size={14} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {avgTAT > 0 && (
                  <div style={{ marginTop:10,padding:'9px 14px',borderRadius:8,background:'rgba(30,95,173,.06)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12 }}>
                    <span style={{ fontSize:12,color:'var(--muted)',fontWeight:600 }}>Total TAT เฉลี่ยต่อ LN</span>
                    <span className="dmono" style={{ fontSize:17,fontWeight:500,color:'var(--primary)',whiteSpace:'nowrap' }}>{fmtMinutes(avgTAT)}</span>
                  </div>
                )}
              </>
            ) : (
              <Empty text="ยังไม่มีข้อมูล Pipeline จาก TAT Module ในเดือนนี้" />
            )}
          </div>
        </div>

        {/* ══ HEATMAPS ══ */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <HeatmapCard
            title="Heatmap การเจาะเลือด"
            sub={`${phlebCount.toLocaleString()} ราย · ${prevMonthLabel}`}
            grid={phlebHeatmap}
            color="#8B5CF6"
            dowLabels={DOW_TH}
            slotLabels={SLOTS}
            href="/tat"
          />
          <HeatmapCard
            title="Heatmap การรับตัวอย่าง (Received)"
            sub={`${tatCount.toLocaleString()} รายการ · ${prevMonthLabel}`}
            grid={tatHeatmap}
            color="#0EA5E9"
            dowLabels={DOW_TH}
            slotLabels={SLOTS}
            href="/tat"
          />
        </div>


      </div>
    </>
  )
}

/* ──────────────── COMPONENTS ──────────────── */

function KpiCard({ icon, label, value, sub, accent, warn = false, change, changeDir, barPct, barLabel, barValue }: {
  icon: string; label: string; value: string; sub: string; accent: string; warn?: boolean
  change?: string; changeDir?: 'up' | 'down'
  barPct?: number; barLabel?: string; barValue?: string
}) {
  return (
    <div className="kpi-card" style={{ background:'var(--card)', border:`1px solid ${warn?`${accent}40`:'var(--border)'}`, borderTop:`3px solid ${accent}`, borderRadius:14, padding:'18px 20px', overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {/* Label + Icon row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</span>
        <div style={{ width:32, height:32, borderRadius:8, background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center', color:accent, flexShrink:0 }}>
          <Icon name={icon} size={15} />
        </div>
      </div>
      {/* Value */}
      <div className="dmono" style={{ fontSize:30, fontWeight:700, color:'var(--ink)', lineHeight:1, letterSpacing:'-.02em' }}>{value}</div>
      {/* Change badge */}
      {change && (
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, fontWeight:600, marginTop:8, padding:'3px 8px', borderRadius:20, width:'fit-content', background: changeDir === 'up' ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)', color: changeDir === 'up' ? '#16A34A' : '#DC2626' }}>
          {changeDir === 'up' ? '▲' : '▼'} {change}
        </span>
      )}
      {/* Sub */}
      <div style={{ fontSize:11.5, color:'var(--muted)', marginTop: change ? 6 : 8, flex: barPct != null ? undefined : 1 }}>{sub}</div>
      {/* Mini bar */}
      {barPct != null && (
        <div style={{ marginTop:'auto', paddingTop:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--muted)', marginBottom:5 }}>
            <span>{barLabel}</span><span>{barValue}</span>
          </div>
          <div style={{ height:4, borderRadius:4, background:'var(--surface-2)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:4, background:accent, width:`${Math.min(100, barPct)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

function HeatmapCard({ title, sub, grid, color, dowLabels, slotLabels, href }: {
  title: string; sub: string; grid: number[][]; color: string
  dowLabels: string[]; slotLabels: string[]; href: string
}) {
  const maxVal = Math.max(1, ...grid.flat())
  // reorder: Mon(1)..Sun(0)
  const ordered = [1,2,3,4,5,6,0]
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:30,height:30,borderRadius:8,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',color }}>
            <Icon name="beaker" size={14} />
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>{title}</div>
            <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>{sub}</div>
          </div>
        </div>
        <Link href={href} style={{ textDecoration:'none' }}>
          <div className="section-link" style={{ fontSize:11,fontWeight:700,color:'var(--muted)',padding:'4px 9px',borderRadius:6,background:'var(--surface-2)',display:'flex',alignItems:'center',gap:4 }}>
            TAT Module <Icon name="arrowRight" size={10} />
          </div>
        </Link>
      </div>
      <div style={{ padding:'16px 20px' }}>
        {/* slot labels */}
        <div style={{ display:'grid', gridTemplateColumns:'28px repeat(6,1fr)', gap:3, marginBottom:4 }}>
          <div />
          {slotLabels.map(s => (
            <div key={s} className="dmono" style={{ fontSize:9.5,color:'var(--muted)',textAlign:'center' }}>{s}:00</div>
          ))}
        </div>
        {/* rows */}
        {ordered.map(dow => (
          <div key={dow} style={{ display:'grid', gridTemplateColumns:'28px repeat(6,1fr)', gap:3, marginBottom:3 }}>
            <div style={{ fontSize:10.5,fontWeight:700,color:'var(--muted)',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:5 }}>
              {dowLabels[dow]}
            </div>
            {grid[dow].map((val, slot) => {
              const intensity = maxVal > 0 ? val / maxVal : 0
              return (
                <div
                  key={slot}
                  className="hm-cell"
                  title={`${dowLabels[dow]} ${slotLabels[slot]}:00–${String(Number(slotLabels[slot])+4).padStart(2,'0')}:00 · ${val} ราย`}
                  style={{
                    height:26, borderRadius:5,
                    background: intensity > 0
                      ? `${color}${Math.round(intensity * 220 + 20).toString(16).padStart(2,'0')}`
                      : 'var(--surface-2)',
                    cursor:'default',
                  }}
                />
              )
            })}
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
          <div style={{ fontSize:10,color:'var(--muted)' }}>น้อย</div>
          {[0.1,0.3,0.5,0.7,0.9].map(v => (
            <div key={v} style={{ width:16,height:10,borderRadius:3,background:`${color}${Math.round(v*220+20).toString(16).padStart(2,'0')}` }} />
          ))}
          <div style={{ fontSize:10,color:'var(--muted)' }}>มาก</div>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ title, sub, href, hrefLabel, icon, iconColor, children, plainLink = false }: {
  title: string; sub: string; href: string; hrefLabel: string; icon: string; iconColor: string; children: React.ReactNode; plainLink?: boolean
}) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:30,height:30,borderRadius:8,background:`${iconColor}18`,display:'flex',alignItems:'center',justifyContent:'center',color:iconColor,flexShrink:0 }}>
            <Icon name={icon} size={14} />
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>{title}</div>
            <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>{sub}</div>
          </div>
        </div>
        <Link href={href} style={{ textDecoration:'none' }}>
          {plainLink ? (
            <span style={{ fontSize:12.5,fontWeight:600,color:'var(--primary)',whiteSpace:'nowrap' }}>{hrefLabel} →</span>
          ) : (
            <div className="section-link" style={{ display:'flex',alignItems:'center',gap:4,fontSize:11.5,fontWeight:700,color:'var(--muted)',padding:'5px 10px',borderRadius:7,background:'var(--surface-2)',whiteSpace:'nowrap' }}>
              {hrefLabel} <Icon name="arrowRight" size={11} />
            </div>
          )}
        </Link>
      </div>
      <div style={{ padding:'16px 20px' }}>{children}</div>
    </div>
  )
}

function ContractCard({ contract }: { contract: ContractWithUsage }) {
  const total    = contract.total ?? 0
  const pct      = total > 0 ? Math.min((contract.used / total) * 100, 100) : 0
  const remaining = 100 - pct
  const ml = contract.end_date
    ? Math.floor((new Date(contract.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
    : 999
  const isExpiry = total > 10_000_000 ? ml <= 6 : ml <= 3
  const isLowBudget = remaining < 30
  const barColor = isExpiry ? '#DC2626' : isLowBudget ? '#D97706' : '#16A34A'
  const tags: string[] = []
  if (isExpiry) tags.push(ml <= 0 ? 'หมดอายุแล้ว' : `เหลือ ${ml} เดือน`)
  if (isLowBudget) tags.push(`งบเหลือ ${remaining.toFixed(0)}%`)

  return (
    <div className="contract-card" style={{ padding:'10px 12px', borderRadius:9, border:`1px solid ${isExpiry?'#FECACA':isLowBudget?'#FDE68A':'var(--border)'}`, background:isExpiry?'rgba(220,38,38,.04)':isLowBudget?'rgba(217,119,6,.04)':'var(--surface-2)' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12.5,fontWeight:700,color:'var(--ink)',wordBreak:'break-word' }}>{contract.vendor}</div>
          <div style={{ fontSize:11,color:'var(--muted)',marginTop:1,wordBreak:'break-word' }}>{contract.product}</div>
        </div>
        <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0,marginLeft:8 }}>
          {tags.map(tag => (
            <span key={tag} style={{ fontSize:9.5,fontWeight:800,color:isExpiry?'#DC2626':'#D97706',background:isExpiry?'#FEE2E2':'#FEF3C7',padding:'1px 7px',borderRadius:20,whiteSpace:'nowrap' }}>{tag}</span>
          ))}
        </div>
      </div>
      <div style={{ height:4,background:'var(--border)',borderRadius:99,overflow:'hidden' }}>
        <div style={{ height:'100%',width:`${pct}%`,background:barColor,borderRadius:99 }} />
      </div>
      <div className="dmono" style={{ fontSize:10.5,color:'var(--muted)',marginTop:4 }}>
        ใช้ {contract.used.toLocaleString()} / {total.toLocaleString()} {contract.unit ?? ''}
      </div>
    </div>
  )
}

const ACTION_LABELS: Record<string, string> = {
  'test.update':           'แก้ไขรายการตรวจ',
  'test.create':           'เพิ่มรายการตรวจ',
  'test.delete':           'ลบรายการตรวจ',
  'permission.update':     'อัปเดต Permission',
  'user.update':           'อัปเดตผู้ใช้',
  'user.create':           'เพิ่มผู้ใช้',
  'document.upload':       'อัปโหลดเอกสาร',
  'document.edit':         'แก้ไขเอกสาร',
  'document.delete':       'ลบเอกสาร',
  'document.status_change':'เปลี่ยนสถานะเอกสาร',
  'document.download':     'ดาวน์โหลดเอกสาร',
  'category.update':       'แก้ไขหมวดหมู่',
  'category.create':       'เพิ่มหมวดหมู่',
  'rejection.create':      'บันทึก Rejection',
  'equipment.create':      'เพิ่มเครื่องมือ',
  'equipment.update':      'แก้ไขเครื่องมือ',
  'equipment.delete':      'ลบเครื่องมือ',
  'contract.create':       'เพิ่มสัญญา',
  'contract.update':       'แก้ไขสัญญา',
  'contract.delete':       'ลบสัญญา',
  'contract.usage_add':    'บันทึกค่าใช้จ่ายสัญญา',
  'risk.create':           'บันทึกความเสี่ยง',
  'risk.update':           'แก้ไขความเสี่ยง',
  'risk.delete':           'ลบความเสี่ยง',
  'risk.close':            'ปิดประเด็นความเสี่ยง',
  'kpi.entry':             'บันทึก KPI',
}

function parseActivityTitle(action: string | null, target: string | null, detail: string | null): string {
  const a = action ?? ''
  const verbLabel = ACTION_LABELS[a] ?? a

  // detail is a JSON blob → extract human-readable name
  if (detail && detail.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(detail) as Record<string, unknown>
      // test records have th/en name
      if (a.startsWith('test.')) {
        const name = (parsed.th as string) || (parsed.en as string) || (parsed.code as string)
        return name ? `${verbLabel}: ${name}` : verbLabel
      }
      // document records
      if (a.startsWith('document.')) {
        const name = (parsed.doc_number as string) || (parsed.title as string) || (parsed.file_name as string)
        return name ? `${verbLabel}: ${name}` : verbLabel
      }
      // user records
      if (a.startsWith('user.')) {
        const name = (parsed.full_name as string) || (parsed.name as string)
        return name ? `${verbLabel}: ${name}` : verbLabel
      }
    } catch { /* ignore parse error */ }
    return verbLabel
  }

  // detail is plain text (short human-readable string)
  if (detail && detail.length <= 120) return detail
  if (target) return `${verbLabel}: ${target}`
  return verbLabel || 'กิจกรรม'
}

function ActivityFeedItem({ entry, profileName, isLast }: { entry: AuditEntry; profileName: string; isLast: boolean }) {
  const dotColor = actionDotColor(entry.action)
  const title = parseActivityTitle(entry.action, entry.target, entry.detail)
  const meta = profileName ? `โดย ${profileName}` : (ACTION_LABELS[entry.action ?? ''] ?? entry.action ?? '')
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:dotColor, marginTop:4, flexShrink:0, position:'relative', zIndex:1, boxShadow:`0 0 0 2px var(--card)` }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
        {meta && <div style={{ fontSize:11.5, color:'var(--muted)', marginTop:1.5 }}>{meta}</div>}
      </div>
      <div style={{ fontSize:11, color:'var(--muted)', flexShrink:0, marginTop:2, whiteSpace:'nowrap' }}>{fmtActivityTime(entry.created_at)}</div>
    </div>
  )
}

function Empty({ text, icon = 'check' }: { text: string; icon?: string }) {
  return (
    <div style={{ textAlign:'center', padding:'26px 0', color:'var(--muted)' }}>
      <div style={{ opacity:.3, marginBottom:8 }}><Icon name={icon} size={20} /></div>
      <div style={{ fontSize:12.5 }}>{text}</div>
    </div>
  )
}
