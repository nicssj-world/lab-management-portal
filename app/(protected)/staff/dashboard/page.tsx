import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getContracts } from '@/lib/queries/contracts'
import { getRolePermissions } from '@/lib/permissions'
import { getPendingApprovalDocuments } from '@/lib/documents/pending'
import { sortByOldestUpdated, sortContractsByUrgency, monthsLeftUntil, isContractExpiring } from '@/lib/dashboard/attention-queue'
import { expiryStatus } from '@/lib/personnel/expiry'
import { Icon } from '@/components/ui/Icon'
import { Empty } from '@/components/dashboard/Empty'
import { AttentionQueue } from '@/components/dashboard/AttentionQueue'
import { AnalyticsTabs } from '@/components/dashboard/AnalyticsTabs'
import Link from 'next/link'
import { getQualityTaskOccurrences } from '@/lib/quality-tasks/server'
import type { PermLevel } from '@/lib/permissions'

export const dynamic = 'force-dynamic'


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
  const tz = 'Asia/Bangkok'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const dStr = d.toLocaleDateString('en-CA', { timeZone: tz })
  const diffDays = Math.round((new Date(todayStr).getTime() - new Date(dStr).getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  if (diffDays === 1) return 'เมื่อวาน'
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: tz })
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = user
    ? await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const permissions = actor?.role ? await getRolePermissions(actor.role) : {}

  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const curMonthLabel = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  // เดือนที่แล้ว
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  const prevMonthLabel = new Date(prevYear, prevMonth - 1, 1)
    .toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  const pendingDocsPromise = getPendingApprovalDocuments()

  // ── ดึงข้อมูลทั้งหมดพร้อมกัน ──
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01T00:00:00`
  const nextMonthStart = prevMonth === 12
    ? `${prevYear + 1}-01-01T00:00:00`
    : `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01T00:00:00`

  // เดือนปัจจุบัน (สำหรับการ์ดระดับความรุนแรง RM)
  const curMonthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const curNextMonthStart = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const [
    contracts,
    riskSeverityMonthResult,
    testActiveResult,
    testTotalResult,
    staffTotalResult,
    staffMtResult,
    staffMtLicenseResult,
    docTotalResult,
    docPublishedResult,
    docNewResult,
    docReviewResult,
    docDraftResult,
    docObsoleteResult,
    auditLogResult,
  ] = await Promise.all([
    getContracts(supabaseAdmin),
    supabaseAdmin.from('risks')
      .select('severity_level')
      .gte('event_date', curMonthStart)
      .lt('event_date', curNextMonthStart),
    supabaseAdmin.from('tests').select('*', { count: 'exact', head: true }).eq('active', true),
    supabaseAdmin.from('tests').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('role', 'Medical Technologist'),
    supabaseAdmin.from('profiles').select('mt_license_expiry').is('deleted_at', null).eq('role', 'Medical Technologist'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Published'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', prevMonthStart).lt('created_at', nextMonthStart),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Review'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Draft'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Obsolete'),
    supabaseAdmin
      .from('audit_log')
      .select('id, action, target, detail, created_at, user_id')
      .not('action', 'in', '("permission.update","settings.update","user.update","user.create","document.cover_generate","document.cover_regenerate")')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const pendingDocsAll = await pendingDocsPromise
  const pendingDocs = sortByOldestUpdated(pendingDocsAll)

  const qualityLevel = (permissions['งานคุณภาพ'] ?? 'none') as PermLevel
  const qualityToday = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const qualityYear = Number(qualityToday.slice(0, 4)); const qualityMonth = Number(qualityToday.slice(5, 7))
  const qualityFiscalStart = `${qualityMonth >= 10 ? qualityYear : qualityYear - 1}-10-01`
  const qualityFiscalEnd = `${qualityMonth >= 10 ? qualityYear + 1 : qualityYear}-09-30`
  const qualityTasks = qualityLevel === 'none' || !user ? [] : (await getQualityTaskOccurrences({ from: qualityFiscalStart, to: qualityFiscalEnd, actorId: user.id, level: qualityLevel, scope: qualityLevel === 'edit' ? 'all' : 'mine' })).filter(t => t.urgency === 'due-soon' || t.urgency === 'overdue')

  let staffLicenseExpired = 0
  let staffLicenseExpiring = 0
  for (const row of (staffMtLicenseResult.data ?? []) as { mt_license_expiry: string | null }[]) {
    const status = expiryStatus(row.mt_license_expiry)
    if (status === 'expired') staffLicenseExpired++
    else if (status === 'expiring') staffLicenseExpiring++
  }

  const SEVERITY_LEVELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const
  // Same palette as the Risk Register's own "ระดับความรุนแรง (RM)" panel (components/risk/RiskClient.tsx)
  const SEVERITY_COLORS: Record<string, string> = {
    A: '#EF4444', B: '#F59E0B', C: '#3B82F6', D: '#10B981', E: '#8B5CF6',
    F: '#EC4899', G: '#64748B', H: '#475569', I: '#111827',
  }
  const riskSeverityCounts: Record<string, number> = Object.fromEntries(SEVERITY_LEVELS.map(l => [l, 0]))
  for (const row of (riskSeverityMonthResult.data ?? []) as { severity_level: string | null }[]) {
    const lvl = row.severity_level?.trim().toUpperCase()
    if (lvl && lvl in riskSeverityCounts) riskSeverityCounts[lvl]++
  }
  const maxSeverityCount = Math.max(1, ...Object.values(riskSeverityCounts))

  const testCount    = testActiveResult.count ?? 0
  const testTotal    = testTotalResult.count ?? 0
  const staffTotal   = staffTotalResult.count ?? 0
  const staffMt      = staffMtResult.count ?? 0
  const docTotal     = docTotalResult.count ?? 0
  const docPublished = docPublishedResult.count ?? 0
  const docNew       = docNewResult.count ?? 0
  const docReview    = docReviewResult.count ?? 0
  const docDraft     = docDraftResult.count ?? 0
  const docObsolete  = docObsoleteResult.count ?? 0

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

  // Enrich contract.usage_add entries with product/vendor for old records that lack it
  const usageContractIds = [...new Set(
    auditLogs.filter(l => l.action === 'contract.usage_add' && l.target).map(l => l.target as string)
  )]
  if (usageContractIds.length > 0) {
    const numIds = usageContractIds.map(Number).filter(n => !isNaN(n))
    if (numIds.length > 0) {
      const { data: ctrs } = await supabaseAdmin.from('contracts').select('id, vendor, product').in('id', numIds)
      const contractNames: Record<string, string> = {}
      for (const c of ctrs ?? []) contractNames[String(c.id)] = (c.product || c.vendor) ?? ''
      for (const log of auditLogs) {
        if (log.action === 'contract.usage_add' && log.target) {
          const name = contractNames[log.target]
          if (name && log.detail && !log.detail.startsWith(name)) {
            log.detail = `${name} · ${log.detail}`
          }
        }
      }
    }
  }

  const activeContracts = contracts.filter(c => c.status === 'active')
  const criticalContractsAll = sortContractsByUrgency(activeContracts.filter(c => {
    const ml = monthsLeftUntil(c.end_date)
    const isExpiring = isContractExpiring(c.total, ml)
    const budgetRemaining = c.total > 0 ? ((c.total - c.used) / c.total) * 100 : 100
    const alreadyExpired = ml <= 0
    const budgetExhausted = budgetRemaining <= 0
    if (alreadyExpired || budgetExhausted) return false
    return isExpiring || budgetRemaining < 30
  }))
  const totalContractValue = activeContracts.reduce((sum, c) => sum + (c.total ?? 0), 0)
  const usedContractValue  = activeContracts.reduce((sum, c) => sum + (c.used ?? 0), 0)

  const todayStr = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr  = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

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
        .contract-card{transition:border-color .15s}
        .contract-card:hover{border-color:var(--primary)!important}
        .section-link:hover{background:var(--primary-soft)!important;color:var(--primary)!important}
        .qa-tile{transition:background .15s,border-color .15s}
        .qa-tile:hover{background:var(--primary-soft)!important;border-color:var(--primary)!important}
        .activity-timeline{position:relative}
        .activity-timeline::before{content:'';position:absolute;left:3px;top:18px;bottom:18px;width:1px;background:var(--border);z-index:0}
        .more-link{display:block;text-align:center;font-size:12px;font-weight:600;color:var(--muted);padding:9px 0;border-radius:8px;background:var(--surface-2);transition:all .15s;text-decoration:none}
        .more-link:hover{background:var(--primary-soft);color:var(--primary)}
        @keyframes dashFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .dash-fade{animation:dashFadeUp .5s cubic-bezier(.22,1,.36,1) backwards}
        @media (prefers-reduced-motion: reduce){.dash-fade{animation:none}}
        @media(max-width:640px){
          .dash-kpi-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
          .dash-attention-grid{grid-template-columns:repeat(2,1fr)!important}
          .dash-main-grid{grid-template-columns:1fr!important;align-items:start!important}
          .dash-hero{padding:16px 18px!important}
          .dash-hero .ops-title{font-size:20px!important}
          .dash-hero .live-label{font-size:9px!important}
          .kpi-card{padding:14px 16px!important}
        }
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

        {/* ══ HERO ══ */}
        <div style={{
          background:'linear-gradient(135deg,#0B1426 0%,#112240 55%,#1E5FAD 100%)',
          borderRadius:18, padding:'22px 28px',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16,
          position:'relative', overflow:'hidden',
        }} className="dash-hero">
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
        <div className="dash-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          <KpiCard
            icon="flask" label="รายการตรวจทั้งหมด" accent="#0EA5E9" delay={0.02}
            value={testCount.toLocaleString()} sub="รายการที่ใช้งานอยู่"
            barLabel="Active" barValue={`${testCount}/${testTotal}`}
            barPct={testTotal ? (testCount / testTotal) * 100 : 0}
          />
          <KpiCard
            icon="doc" label="เอกสารคุณภาพ" accent="#0D9488" delay={0.08}
            value={docTotal.toLocaleString()} sub={prevMonthLabel}
            change={docNew > 0 ? `+${docNew} ฉบับ` : undefined}
            changeDir="up"
            barLabel="Published" barValue={`${docPublished}/${docTotal}`}
            barPct={docTotal > 0 ? (docPublished / docTotal) * 100 : 0}
          />
          <KpiCard
            icon="users" label="อัตรากำลัง" accent="#8B5CF6" delay={0.14}
            value={staffTotal.toLocaleString()} sub="บุคลากรทั้งหมด"
            barLabel="นักเทคนิคการแพทย์" barValue={`${staffMt}/${staffTotal}`}
            barPct={staffTotal ? (staffMt / staffTotal) * 100 : 0}
          />
          <KpiCard
            icon="building" label="สัญญาทั้งหมด" accent="#7C3AED" delay={0.2}
            value={contracts.length.toLocaleString()} sub={`มูลค่ารวม ฿${totalContractValue.toLocaleString()}`}
            barLabel="ใช้ไปแล้ว" barValue={`฿${usedContractValue.toLocaleString()}`}
            barPct={totalContractValue ? (usedContractValue / totalContractValue) * 100 : 0}
          />
        </div>

        {/* ══ ATTENTION QUEUE ══ */}
        <div className="dash-fade" style={{ animationDelay: '.22s' }}>
          <AttentionQueue
            pendingDocs={pendingDocs}
            totalPendingDocs={pendingDocs.length}
            contracts={criticalContractsAll}
            totalContracts={criticalContractsAll.length}
            staffLicenseExpired={staffLicenseExpired}
            staffLicenseExpiring={staffLicenseExpiring}
            permissions={permissions}
            qualityTasks={qualityTasks}
          />
        </div>

        {/* ══ ANALYTICS ══ */}
        <div className="dash-fade" style={{ animationDelay: '.26s' }}>
          <AnalyticsTabs />
        </div>

        {/* ══ ACTIVITY + DOCUMENT STATUS ══ */}
        <div className="dash-main-grid dash-fade" style={{ display:'grid', gridTemplateColumns:'7fr 3fr', gap:16, alignItems:'stretch', animationDelay:'.44s' }}>

          {/* Recent Activity — custom card with timeline */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>
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
            </div>
            <div style={{ padding:'8px 20px 0', flex:1, display:'flex', flexDirection:'column' }}>
              {auditLogs.length > 0 ? (
                <div className="activity-timeline">
                  {auditLogs.slice(0, 6).map((entry, i) => (
                    <ActivityFeedItem
                      key={entry.id}
                      entry={entry}
                      profileName={entry.user_id ? (profileMap[entry.user_id] ?? '') : ''}
                      isLast={i === Math.min(5, auditLogs.length - 1)}
                    />
                  ))}
                </div>
              ) : (
                <Empty text="ยังไม่มีกิจกรรมในระบบ" icon="clock" />
              )}
              <div style={{ marginTop:'auto', padding:'12px 0 16px' }}>
                <Link href="/staff/activity" className="more-link">
                  ดูกิจกรรมทั้งหมด →
                </Link>
              </div>
            </div>
          </div>

          {/* Right column — Document status + RM severity, stacked as separate cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Document status bars */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30,height:30,borderRadius:8,background:'rgba(13,148,136,.14)',display:'flex',alignItems:'center',justifyContent:'center',color:'#0D9488',flexShrink:0 }}>
                  <Icon name="doc" size={14} />
                </div>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--ink)' }}>เอกสารตามสถานะ</div>
              </div>
              <div style={{ padding:'14px 16px' }}>
                {([
                  { label:'Published', count:docPublished, color:'#16A34A' },
                  { label:'Review',    count:docReview,    color:'#1E5FAD' },
                  { label:'Draft',     count:docDraft,     color:'#D97706' },
                  { label:'Obsolete',  count:docObsolete,  color:'#DC2626' },
                ] as const).map(({ label, count, color }) => {
                  const pct = docTotal > 0 ? (count / docTotal) * 100 : 0
                  const barWidth = Math.max(pct, count > 0 ? 2 : 0)
                  return (
                    <div key={label} style={{ marginBottom:9 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                        <span style={{ fontSize:12,color:'var(--ink)',fontWeight:600 }}>{label}</span>
                        <span style={{ fontSize:12,color,fontWeight:700 }}>{count} ฉบับ</span>
                      </div>
                      <div style={{ height:4,background:'var(--border)',borderRadius:99,overflow:'hidden' }}>
                        <div style={{ height:'100%',width:`${barWidth}%`,background:color,borderRadius:99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RM severity — separate card */}
            {(permissions['ความเสี่ยง / Rejection'] ?? 'none') !== 'none' && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:30,height:30,borderRadius:8,background:'rgba(220,38,38,.14)',display:'flex',alignItems:'center',justifyContent:'center',color:'#DC2626',flexShrink:0 }}>
                    <Icon name="shield" size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>ระดับความรุนแรง (RM)</div>
                    <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>{curMonthLabel}</div>
                  </div>
                </div>
                <div style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    {SEVERITY_LEVELS.map(level => {
                      const count = riskSeverityCounts[level]
                      const color = SEVERITY_COLORS[level] ?? '#94A3B8'
                      const pct = Math.round(count / maxSeverityCount * 100)
                      return (
                        <div key={level} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:14, color, fontWeight:900, fontSize:11.5 }}>{level}</div>
                          <div style={{ flex:1, height:8, borderRadius:999, background:'var(--surface-2)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:999 }} />
                          </div>
                          <div style={{ width:26, textAlign:'right', color:'var(--muted)', fontSize:11 }}>{count}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </>
  )
}

/* ──────────────── COMPONENTS ──────────────── */

function KpiCard({ icon, label, value, sub, accent, warn = false, change, changeDir, barPct, barLabel, barValue, delay = 0 }: {
  icon: string; label: string; value: string; sub: string; accent: string; warn?: boolean
  change?: string; changeDir?: 'up' | 'down'
  barPct?: number; barLabel?: string; barValue?: string; delay?: number
}) {
  return (
    <div className="kpi-card dash-fade" style={{ background:'var(--card)', border:`1px solid ${warn?`${accent}40`:'var(--border)'}`, borderTop:`3px solid ${accent}`, borderRadius:14, padding:'18px 20px', overflow:'hidden', display:'flex', flexDirection:'column', animationDelay:`${delay}s` }}>
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

const ACTION_LABELS: Record<string, string> = {
  // รายการตรวจ
  'test.create':                                  'เพิ่มรายการตรวจ',
  'test.update':                                  'แก้ไขรายการตรวจ',
  'test.delete':                                  'ลบรายการตรวจ',
  'test.bulk_delete':                             'ลบรายการตรวจ (กลุ่ม)',
  'test.import':                                  'นำเข้ารายการตรวจ',
  'test.duplicate':                               'คัดลอกรายการตรวจ',
  'test.purge_deleted':                           'ลบถาวรรายการตรวจ',
  'category.create':                              'เพิ่มหมวดหมู่',
  'category.update':                              'แก้ไขหมวดหมู่',
  // เอกสาร — workflow เดิม
  'document.upload':                              'อัปโหลดเอกสาร',
  'document.edit':                                'แก้ไขเอกสาร',
  'document.delete':                              'ลบเอกสาร',
  'document.status_change':                       'เปลี่ยนสถานะเอกสาร',
  'document.download':                            'ดาวน์โหลดเอกสาร',
  'document.current_revision_rollback':           'ย้อนกลับเวอร์ชันเอกสาร',
  // เอกสาร — working revision workflow
  'document.revision_draft_create':               'สร้าง Working Revision',
  'document.revision_draft_status':               'เปลี่ยนสถานะ Working Revision',
  'document.revision_draft_publish':              'เผยแพร่เอกสาร (Publish)',
  'document.revision_draft_publish_existing_cover': 'เผยแพร่เอกสาร (ใช้หน้าปกเดิม)',
  // เอกสาร — ประวัติการแก้ไข
  'document.revision_history_backfill_create':    'เพิ่มประวัติการแก้ไขย้อนหลัง',
  'document.revision_history_backfill_update':    'แก้ไขประวัติการแก้ไขย้อนหลัง',
  'document.revision_history_backfill_delete':    'ลบประวัติการแก้ไขย้อนหลัง',
  'document.revision_history_date_update':        'แก้ไขวันที่ประวัติการแก้ไข',
  // เครื่องมือ
  'equipment.create':                             'เพิ่มเครื่องมือ',
  'equipment.update':                             'แก้ไขเครื่องมือ',
  'equipment.delete':                             'ลบเครื่องมือ',
  // สัญญา
  'contract.create':                              'เพิ่มสัญญา',
  'contract.update':                              'แก้ไขสัญญา',
  'contract.delete':                              'ลบสัญญา',
  'contract.usage_add':                           'บันทึกค่าใช้จ่ายสัญญา',
  // ความเสี่ยง
  'risk.create':                                  'บันทึกความเสี่ยง',
  'risk.update':                                  'แก้ไขความเสี่ยง',
  'risk.delete':                                  'ลบความเสี่ยง',
  'risk.close':                                   'ปิดประเด็นความเสี่ยง',
  'rejection.create':                             'บันทึก Rejection',
  // KPI
  'kpi.entry':                                    'บันทึก KPI',
  // ข่าวสาร
  'create_news':                                  'เพิ่มข่าวสาร',
  'update_news':                                  'แก้ไขข่าวสาร',
  'delete_news':                                  'ลบข่าวสาร',
  // บุคลากร
  'personnel.profile.update':                     'แก้ไขโปรไฟล์บุคลากร',
  'personnel.org.create':                         'เพิ่มโครงสร้างองค์กร',
  'personnel.org.delete':                         'ลบโครงสร้างองค์กร',
  'personnel.jd.create':                          'เพิ่มข้อกำหนดตำแหน่งงาน',
  'personnel.jd.update':                          'แก้ไขข้อกำหนดตำแหน่งงาน',
  // โปรไฟล์เอกสาร / ลายเซ็น
  'document_profile.update':                      'แก้ไขโปรไฟล์เอกสาร',
  'document_profile.update_self':                 'แก้ไขโปรไฟล์เอกสาร (ตัวเอง)',
  'document_profile.signature_upload':            'อัปโหลดลายเซ็น',
  'document_profile.signature_upload_self':       'อัปโหลดลายเซ็น (ตัวเอง)',
  'document_profile.signature_delete':            'ลบลายเซ็น',
  'document_profile.signature_delete_self':       'ลบลายเซ็น (ตัวเอง)',
  // ระบบ
  'user.update':                                  'อัปเดตผู้ใช้',
  'user.create':                                  'เพิ่มผู้ใช้',
  'manual_edit':                                  'แก้ไขคู่มือ',
  'permission.update':                            'แก้ไขสิทธิ์ผู้ใช้',
  'settings.update':                              'แก้ไขการตั้งค่าระบบ',
  'phleb_upload_init':                            'อัปโหลดข้อมูล Phlebotomy',
}

const STATUS_TH: Record<string, string> = {
  'Draft':     'ร่าง',
  'Review':    'รอตรวจสอบ',
  'Approved':  'อนุมัติแล้ว',
  'Published': 'เผยแพร่แล้ว',
  'Obsolete':  'ยกเลิกใช้งาน',
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:[0-9a-f-]+)?$/i.test(s)
}

function translateStatuses(s: string) {
  return s.replace(/\b(Draft|Review|Approved|Published|Obsolete)\b/g, m => STATUS_TH[m] ?? m)
}

function parseActivityTitle(action: string | null, target: string | null, detail: string | null): string {
  const a = action ?? ''
  const t = (target ?? '').trim()
  const d = (detail ?? '').trim()
  const safeTarget = isUuid(t) ? '' : t

  // JSON detail (test.* actions)
  if (d.startsWith('{')) {
    try {
      const p = JSON.parse(d) as Record<string, unknown>
      if (a.startsWith('test.')) {
        const name = (p.th as string) || (p.en as string) || (p.code as string) || ''
        return [safeTarget, name].filter(Boolean).join(' · ').slice(0, 120)
      }
    } catch { /* ignore */ }
    return safeTarget
  }

  // Working revision status change: "Rev. 07 · Draft → Review"
  if (a === 'document.revision_draft_status') {
    return [safeTarget, translateStatuses(d)].filter(Boolean).join(' · ')
  }

  // Document status change (legacy): detail = "CODE · old → new"
  if (a === 'document.status_change') {
    return translateStatuses(d) || safeTarget
  }

  // Publish with existing cover
  if (a === 'document.revision_draft_publish_existing_cover') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0] ?? ''
    return [safeTarget, rev, 'ใช้หน้าปกเดิม'].filter(Boolean).join(' · ')
  }

  // Rollback: "Deleted Rev. X; promoted Rev. Y"
  if (a === 'document.current_revision_rollback') {
    const del = d.match(/Deleted (Rev\.\s*\S+)/)?.[1]
    const prom = d.match(/promoted (Rev\.\s*\S+)/)?.[1]
    return [safeTarget, del ? `ลบ ${del}` : null, prom ? `ย้อนกลับ ${prom}` : null].filter(Boolean).join(' · ')
  }

  // Revision history (target is uuid:uuid — no meaningful target)
  if (a === 'document.revision_history_backfill_create') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0]
    return rev ? `เพิ่ม ${rev}` : 'เพิ่มประวัติ'
  }
  if (a === 'document.revision_history_backfill_update') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0]
    return rev ? `แก้ไข ${rev}` : 'แก้ไขประวัติ'
  }
  if (a === 'document.revision_history_backfill_delete') return 'ลบประวัติย้อนหลัง'
  if (a === 'document.revision_history_date_update') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0]
    return rev ? `แก้ไขวันที่ ${rev}` : 'แก้ไขวันที่ประวัติ'
  }

  // Cover generate — just show code
  if (a === 'document.cover_generate' || a === 'document.cover_regenerate') return safeTarget

  // Permission: target = "role:resource", detail = "Set to level"
  if (a === 'permission.update') {
    return [t, d.replace(/^Set to\s*/i, '')].filter(Boolean).join(' · ')
  }

  // Settings — action label already says it all
  if (a === 'settings.update') return ''

  // Signature upload — show dimensions only
  if (a === 'document_profile.signature_upload' || a === 'document_profile.signature_upload_self') {
    const dims = d.match(/(\d+x\d+)/)?.[1]
    return dims ? `ขนาด ${dims}` : ''
  }

  // Personnel / profile — UUID targets, no useful detail
  if (a.startsWith('personnel.')) {
    if (a === 'personnel.org.delete') {
      const count = d.match(/\d+/)?.[0]
      return count ? `${count} รายการ` : ''
    }
    return ''
  }
  if (a.startsWith('document_profile.')) return ''

  // General document actions: detail often starts with "CODE · ..."
  // Avoid duplicating the code when target === detail prefix
  if (safeTarget && d.startsWith(safeTarget + ' · ')) {
    return d  // detail already contains code + info — use as-is
  }
  if (safeTarget && d && d !== safeTarget) {
    return `${safeTarget} · ${d}`.slice(0, 140)
  }
  return (d || safeTarget).slice(0, 140)
}

function ActivityFeedItem({ entry, profileName, isLast }: { entry: AuditEntry; profileName: string; isLast: boolean }) {
  const dotColor = actionDotColor(entry.action)
  const label = ACTION_LABELS[entry.action ?? ''] ?? entry.action ?? 'กิจกรรม'
  const detail = parseActivityTitle(entry.action, entry.target, entry.detail)
  const meta = profileName ? `โดย ${profileName}` : ''
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:dotColor, marginTop:4, flexShrink:0, position:'relative', zIndex:1, boxShadow:`0 0 0 2px var(--card)` }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
        {detail && <div style={{ fontSize:11.5, color:'var(--ink)', opacity:0.75, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{detail}</div>}
        {meta && <div style={{ fontSize:11.5, color:'var(--muted)', marginTop:1 }}>{meta}</div>}
      </div>
      <div style={{ fontSize:11, color:'var(--muted)', flexShrink:0, marginTop:2, whiteSpace:'nowrap' }}>{fmtActivityTime(entry.created_at)}</div>
    </div>
  )
}

