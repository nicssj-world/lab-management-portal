import { supabaseAdmin } from '@/lib/supabase/admin'
import { getContracts } from '@/lib/queries/contracts'
import { getRejectionLogs } from '@/lib/queries/rejection'
import { readAnalysisCache } from '@/lib/analysis-cache'
import { Icon } from '@/components/ui/Icon'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import Link from 'next/link'


/* ─── helpers ─── */
function fmtMinutes(min: number) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}ช ${m}น` : `${m}น`
}

type HeatCell = { dow: number; hour: number; count: number }

// แปลง heatmap cells จาก RPC (hourly) → grid [7][6] (4-hour slots)
function rpcHeatmapToGrid(cells: HeatCell[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(6).fill(0))
  for (const c of cells) {
    const slot = Math.min(5, Math.floor(c.hour / 4))
    grid[c.dow][slot] += c.count
  }
  return grid
}

export default async function StaffDashboardPage() {
  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // เดือนที่แล้ว
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevEnd   = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]

  const prevMonthLabel = new Date(prevYear, prevMonth - 1, 1)
    .toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  // ── ดึงข้อมูลทั้งหมดพร้อมกัน ──
  const [
    contracts,
    testCountResult,
    rejAllResult,
    rejMonthResult,
    tatRpcResult,
  ] = await Promise.all([
    getContracts(supabaseAdmin),
    supabaseAdmin.from('tests').select('*', { count: 'exact', head: true }).eq('active', true),
    supabaseAdmin
      .from('rejection_logs')
      .select('reject,reason,spcmdate')
      .gte('spcmdate', prevStart)
      .lte('spcmdate', prevEnd)
      .order('spcmdate', { ascending: false })
      .limit(5000),
    getRejectionLogs(supabaseAdmin, { year: prevYear, month: prevMonth, limit: 1 }),
    // ใช้ RPC เดียวกับ TAT module — ได้ทั้ง KPI + heatmap ครบ
    supabaseAdmin.rpc('get_tat_summary', {
      p_year: prevYear, p_month: prevMonth,
      p_lab_section: null, p_ward: null,
      p_priority: null, p_test_name: null, p_labzone: null,
    }),
  ])

  const testCount    = testCountResult.count ?? 0
  const rejThisMonth = rejMonthResult.count ?? 0
  const rejRows      = rejAllResult.data ?? []

  type TatRpcData = {
    kpi?: {
      avg_tat?: number
      avg_total_tat?: number
      pct_within_target?: number
      pct_total_within_target?: number
      total_count?: number
      sample_count?: number
      pipeline_avg_phleb_wait?: number
      avg_phleb_wait?: number
    }
    heatmap?: HeatCell[]
    phleb_heatmap?: HeatCell[]
  }
  console.log('[dashboard] tatRpc error:', tatRpcResult.error)
  console.log('[dashboard] tatRpc data keys:', tatRpcResult.data ? Object.keys(tatRpcResult.data as object) : 'null')
  console.log('[dashboard] tatRpc kpi:', (tatRpcResult.data as TatRpcData)?.kpi)
  const tatData = (tatRpcResult.data ?? {}) as TatRpcData
  const kpi     = tatData.kpi ?? {}

  const avgTAT      = Math.round(kpi.avg_total_tat ?? kpi.avg_tat ?? 0)
  const pctOnTarget = Math.round(kpi.pct_total_within_target ?? kpi.pct_within_target ?? 0)
  const totalSamples = kpi.sample_count ?? kpi.total_count ?? 0
  const avgPhlebWait = kpi.pipeline_avg_phleb_wait
    ? Math.round(kpi.pipeline_avg_phleb_wait)
    : kpi.avg_phleb_wait ? Math.round(kpi.avg_phleb_wait) : null

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

  const PIPELINE: { label: string; sublabel: string; icon: string; value: string | null; color: string }[] = [
    { label: 'ลงทะเบียน',   sublabel: 'แพทย์สั่งตรวจ',         icon: 'doc',     value: null,                                       color: '#0EA5E9' },
    { label: 'ยืนยันคิว',   sublabel: 'ระบบยืนยันนัดเจาะ',      icon: 'check',   value: null,                                       color: '#6366F1' },
    { label: 'เจาะเสร็จ',  sublabel: 'รอเฉลี่ย',               icon: 'syringe', value: avgPhlebWait ? fmtMinutes(avgPhlebWait) : null, color: '#8B5CF6' },
    { label: 'รับ Specimen', sublabel: 'ส่งถึงห้องปฏิบัติการ',  icon: 'cup',     value: null,                                       color: '#10B981' },
    { label: 'รายงานผล',    sublabel: 'TAT เฉลี่ย',             icon: 'chart',   value: avgTAT ? fmtMinutes(avgTAT) : null,           color: '#F59E0B' },
  ]

  // Rejection by reason
  const rejByReason: Record<string, number> = {}
  for (const r of rejRows) {
    const key = r.reject ?? r.reason ?? 'ไม่ระบุ'
    rejByReason[key] = (rejByReason[key] ?? 0) + 1
  }
  const topReasons = Object.entries(rejByReason).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxRej = topReasons[0]?.[1] ?? 1

  const ACCENT = ['#1E5FAD','#0EA5E9','#06B6D4','#10B981','#6366F1','#8B5CF6','#EC4899','#F59E0B']
  const DOW_TH = ['อา','จ','อ','พ','พฤ','ศ','ส']
  const SLOTS   = ['00','04','08','12','16','20']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        .dmono{font-family:'DM Mono',monospace}
        .syne{font-family:'Syne',sans-serif}
        @keyframes breathe{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,211,238,.45)}50%{opacity:.65;box-shadow:0 0 0 7px rgba(34,211,238,0)}}
        .live-dot{animation:breathe 2.4s ease-in-out infinite}
        .kpi-card{transition:transform .18s ease,box-shadow .18s ease}
        .kpi-card:hover{transform:translateY(-3px);box-shadow:0 10px 36px rgba(30,95,173,.13)!important}
        .rej-bar{transition:width .7s cubic-bezier(.22,1,.36,1)}
        .pipeline-step:not(:last-child)::after{content:'';position:absolute;right:-1px;top:50%;transform:translateY(-50%);width:2px;height:60%;background:var(--border)}
        .hm-cell{transition:transform .1s}
        .hm-cell:hover{transform:scale(1.15)}
        .contract-card{transition:border-color .15s}
        .contract-card:hover{border-color:var(--primary)!important}
        .section-link:hover{background:var(--primary-soft)!important;color:var(--primary)!important}
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

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
            <h1 className="syne" style={{ color:'#fff',margin:'0 0 4px',fontSize:24,fontWeight:800,letterSpacing:'-.02em',lineHeight:1.1 }}>
              Lab Operations Center
            </h1>
            <p style={{ color:'rgba(255,255,255,.45)',margin:0,fontSize:12.5 }}>
              กลุ่มงานเทคนิคการแพทย์ · โรงพยาบาลชลบุรี
            </p>
          </div>
        </div>

        {/* ══ KPI ROW ══ */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          <KpiCard icon="flask"    label="รายการตรวจทั้งหมด"   value={testCount.toLocaleString()}        sub="รายการที่ใช้งานอยู่"                   accent="#0EA5E9" />
          <KpiCard icon="inbox"    label="Rejection"            value={rejThisMonth.toLocaleString()}     sub={`${prevMonthLabel} · ${topReasons.length} สาเหตุ`} accent="#F59E0B" warn={rejThisMonth > 50} />
          <KpiCard icon="clock"    label="Total TAT เฉลี่ย"    value={avgTAT ? fmtMinutes(avgTAT) : '—'} sub={totalSamples ? `${prevMonthLabel} · ${pctOnTarget}% ≤ 4ช · ${totalSamples.toLocaleString()} ราย` : `${prevMonthLabel} · ยังไม่มีข้อมูล`} accent={pctOnTarget >= 80 ? '#16A34A' : pctOnTarget >= 60 ? '#D97706' : '#DC2626'} warn={pctOnTarget > 0 && pctOnTarget < 60} />
          <KpiCard icon="building" label="สัญญาใกล้หมด/งบต่ำ" value={criticalContracts.length.toLocaleString()} sub={`จาก ${contracts.length} สัญญา`}  accent={criticalContracts.length > 0 ? '#DC2626' : '#16A34A'} warn={criticalContracts.length > 0} />
        </div>

        {/* ══ PIPELINE ══ */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28,height:28,borderRadius:7,background:'rgba(30,95,173,.12)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--primary)' }}>
              <Icon name="trending" size={13} />
            </div>
            <div>
              <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>Lab Workflow Pipeline</div>
              <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>เวลาเฉลี่ยแต่ละขั้นตอน · {prevMonthLabel}</div>
            </div>
          </div>
          <div style={{ padding:'18px 20px', overflowX:'auto' }}>
            <div style={{ display:'flex', alignItems:'stretch', minWidth:640, gap:0 }}>
              {PIPELINE.map((step, i) => (
                <div key={i} className="pipeline-step" style={{
                  flex:1, position:'relative',
                  padding:'14px 16px',
                  borderRight: i < PIPELINE.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                    <div style={{ width:28,height:28,borderRadius:8,background:`${step.color}15`,display:'flex',alignItems:'center',justifyContent:'center',color:step.color,flexShrink:0 }}>
                      <Icon name={step.icon} size={13} />
                    </div>
                    <div style={{ fontSize:12,fontWeight:800,color:'var(--ink)',lineHeight:1.2 }}>{step.label}</div>
                  </div>
                  <div style={{ fontSize:10.5,color:'var(--muted)',marginBottom:6 }}>{step.sublabel}</div>
                  {step.value
                    ? <div className="dmono" style={{ fontSize:18,fontWeight:500,color:step.color }}>{step.value}</div>
                    : <div className="dmono" style={{ fontSize:16,color:'var(--border)' }}>—</div>
                  }
                  {i < PIPELINE.length - 1 && (
                    <div style={{ position:'absolute',right:-10,top:'50%',transform:'translateY(-50%)',zIndex:2,width:20,height:20,borderRadius:'50%',background:'var(--surface-2)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)' }}>
                      <Icon name="chevRight" size={10} />
                    </div>
                  )}
                </div>
              ))}
            </div>
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

        {/* ══ BOTTOM GRID ══ */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:16, alignItems:'start' }}>

          {/* Rejection bars */}
          <SectionCard title="การปฏิเสธตัวอย่าง — แยกตามสาเหตุ" sub={`รวม ${rejThisMonth.toLocaleString()} ครั้ง · ${prevMonthLabel}`} href="/staff/rejection" hrefLabel="Rejection Log" icon="alert" iconColor="#F59E0B">
            {topReasons.length > 0 ? (
              <div style={{ display:'flex',flexDirection:'column',gap:11 }}>
                {topReasons.map(([reason, count], i) => (
                  <div key={reason}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:5 }}>
                      <span style={{ fontSize:12.5,color:'var(--ink)',fontWeight:600,maxWidth:380,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{reason}</span>
                      <span className="dmono" style={{ fontSize:11.5,color:'var(--muted)',marginLeft:8,flexShrink:0 }}>{count}</span>
                    </div>
                    <div style={{ height:6,background:'var(--surface-2)',borderRadius:99,overflow:'hidden' }}>
                      <div className="rej-bar" style={{ height:'100%',width:`${(count/maxRej)*100}%`,background:ACCENT[i%ACCENT.length],borderRadius:99 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="ไม่มีข้อมูล Rejection เดือนนี้" />
            )}
          </SectionCard>

          {/* Contracts */}
          <SectionCard title="สัญญาใกล้หมดอายุ/งบต่ำ" sub={`ใกล้หมดอายุ หรือ งบเหลือ < 30%`} href="/staff/contracts" hrefLabel="ดูทั้งหมด" icon="building" iconColor="#D97706">
            {criticalContracts.length > 0 ? (
              <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
                {criticalContracts.slice(0, 7).map(c => <ContractCard key={c.id} contract={c} />)}
              </div>
            ) : (
              <Empty text="ไม่มีสัญญาใกล้หมดอายุหรืองบต่ำ" icon="shieldCheck" />
            )}
          </SectionCard>
        </div>

      </div>
    </>
  )
}

/* ──────────────── COMPONENTS ──────────────── */

function KpiCard({ icon, label, value, sub, accent, warn = false }: {
  icon: string; label: string; value: string; sub: string; accent: string; warn?: boolean
}) {
  return (
    <div className="kpi-card" style={{ background:'var(--card)', border:`1px solid ${warn?`${accent}40`:'var(--border)'}`, borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,right:0,width:72,height:72,borderRadius:'0 14px 0 100%',background:`${accent}0C`,pointerEvents:'none' }} />
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
        <div style={{ width:34,height:34,borderRadius:9,background:`${accent}18`,display:'flex',alignItems:'center',justifyContent:'center',color:accent }}>
          <Icon name={icon} size={16} />
        </div>
        {warn && <div style={{ width:7,height:7,borderRadius:'50%',background:accent,boxShadow:`0 0 0 3px ${accent}30` }} />}
      </div>
      <div className="dmono" style={{ fontSize:28,fontWeight:500,color:'var(--ink)',lineHeight:1,letterSpacing:'-.01em' }}>{value}</div>
      <div style={{ fontSize:12,fontWeight:800,color:'var(--ink)',marginTop:6 }}>{label}</div>
      <div style={{ fontSize:11,color:'var(--muted)',marginTop:3 }}>{sub}</div>
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
      <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:7,background:`${color}15`,display:'flex',alignItems:'center',justifyContent:'center',color }}>
            <Icon name="beaker" size={13} />
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

function SectionCard({ title, sub, href, hrefLabel, icon, iconColor, children }: {
  title: string; sub: string; href: string; hrefLabel: string; icon: string; iconColor: string; children: React.ReactNode
}) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:7,background:`${iconColor}15`,display:'flex',alignItems:'center',justifyContent:'center',color:iconColor,flexShrink:0 }}>
            <Icon name={icon} size={13} />
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>{title}</div>
            <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>{sub}</div>
          </div>
        </div>
        <Link href={href} style={{ textDecoration:'none' }}>
          <div className="section-link" style={{ display:'flex',alignItems:'center',gap:4,fontSize:11.5,fontWeight:700,color:'var(--muted)',padding:'5px 10px',borderRadius:7,background:'var(--surface-2)',whiteSpace:'nowrap' }}>
            {hrefLabel} <Icon name="arrowRight" size={11} />
          </div>
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
          <div style={{ fontSize:12.5,fontWeight:700,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:210 }}>{contract.vendor}</div>
          <div style={{ fontSize:11,color:'var(--muted)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:210 }}>{contract.product}</div>
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

function Empty({ text, icon = 'check' }: { text: string; icon?: string }) {
  return (
    <div style={{ textAlign:'center', padding:'26px 0', color:'var(--muted)' }}>
      <div style={{ opacity:.3, marginBottom:8 }}><Icon name={icon} size={20} /></div>
      <div style={{ fontSize:12.5 }}>{text}</div>
    </div>
  )
}
