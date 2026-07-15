import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getContracts } from '@/lib/queries/contracts'
import { getRolePermissions, type Permissions } from '@/lib/permissions'
import { getPendingApprovalDocuments } from '@/lib/documents/pending'
import { sortByOldestUpdated, sortContractsByUrgency, monthsLeftUntil, isContractExpiring } from '@/lib/dashboard/attention-queue'
import { expiryStatus } from '@/lib/personnel/expiry'
import { Icon } from '@/components/ui/Icon'
import { Empty } from '@/components/dashboard/Empty'
import { AttentionQueue } from '@/components/dashboard/AttentionQueue'
import { AnalyticsTabs } from '@/components/dashboard/AnalyticsTabs'
import Link from 'next/link'
import { getQualityTaskOccurrences } from '@/lib/quality-tasks/server'
import type { QualityTaskOccurrence } from '@/lib/quality-tasks/types'
import { getEntryStatus } from '@/lib/queries/kpi'
import { getPreviousThaiFiscalMonth } from '@/lib/kpi-utils'
import { getKpiCompletionState, getKpiProgressColor } from '@/lib/dashboard/kpi-completion'
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

function qualityScheduleTitle(task: QualityTaskOccurrence): string {
  const occurrenceTitle = task.scheduleId === null ? task.periodLabel.trim() : ''
  return occurrenceTitle || task.template.title.trim() || task.template.categoryName.trim()
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

  const [
    contracts,
    testActiveResult,
    testTotalResult,
    staffTotalResult,
    staffMtResult,
    staffMtLicenseResult,
    staffCompetencyResult,
    docTotalResult,
    docPublishedResult,
    docNewResult,
    auditLogResult,
  ] = await Promise.all([
    getContracts(supabaseAdmin),
    supabaseAdmin.from('tests').select('*', { count: 'exact', head: true }).eq('active', true),
    supabaseAdmin.from('tests').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('role', 'Medical Technologist'),
    supabaseAdmin.from('profiles').select('mt_license_expiry').is('deleted_at', null).eq('role', 'Medical Technologist'),
    supabaseAdmin.from('staff_competencies').select('next_due_date').is('deleted_at', null),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Published'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', prevMonthStart).lt('created_at', nextMonthStart),
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
  const qualityOccurrences = qualityLevel === 'none' || !user ? [] : await getQualityTaskOccurrences({ from: qualityFiscalStart, to: qualityFiscalEnd, actorId: user.id, level: qualityLevel, scope: 'all' })
  const qualityTasks = qualityOccurrences.filter(t => t.urgency === 'due-soon' || t.urgency === 'overdue')
  const qualityHorizon = new Date(`${qualityToday}T00:00:00+07:00`)
  qualityHorizon.setDate(qualityHorizon.getDate() + 7)
  const qualityHorizonDate = qualityHorizon.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const qualityUpcoming = qualityOccurrences
    .filter(t => t.effectiveDueDate >= qualityToday && t.effectiveDueDate <= qualityHorizonDate)
    .slice(0, 5)

  const canSeeKpi = (permissions['KPI'] ?? 'none') !== 'none'
  const kpiPeriod = getPreviousThaiFiscalMonth(new Date(`${qualityToday}T12:00:00+07:00`))
  const kpiStatusRows = canSeeKpi ? await getEntryStatus(supabaseAdmin, kpiPeriod.fiscalYear) : []
  const kpiDepartments = kpiStatusRows.filter(row => row.months[kpiPeriod.month]?.required > 0)
  const kpiRequired = kpiDepartments.reduce((sum, row) => sum + row.months[kpiPeriod.month].required, 0)
  const kpiFilled = kpiDepartments.reduce((sum, row) => sum + Math.min(row.months[kpiPeriod.month].filled, row.months[kpiPeriod.month].required), 0)
  const kpiCompletion = kpiRequired > 0 ? Math.round((kpiFilled / kpiRequired) * 100) : 100
  const kpiCompleteDepartments = kpiDepartments.filter(row => row.months[kpiPeriod.month].filled >= row.months[kpiPeriod.month].required).length
  const kpiIncompleteDepartments = kpiDepartments
    .filter(row => row.months[kpiPeriod.month].filled < row.months[kpiPeriod.month].required)
    .sort((a, b) => {
      const aMonth = a.months[kpiPeriod.month]; const bMonth = b.months[kpiPeriod.month]
      return (aMonth.filled / aMonth.required) - (bMonth.filled / bMonth.required)
    })
  const kpiDeadline = `${qualityYear}-${String(qualityMonth).padStart(2, '0')}-15`
  const kpiDaysRemaining = Math.round((Date.parse(`${kpiDeadline}T00:00:00+07:00`) - Date.parse(`${qualityToday}T00:00:00+07:00`)) / 86_400_000)
  const kpiPeriodLabel = new Date(kpiPeriod.year, kpiPeriod.month - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  const kpiDeadlineLabel = new Date(`${kpiDeadline}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

  let staffLicenseExpired = 0
  let staffLicenseExpiring = 0
  for (const row of (staffMtLicenseResult.data ?? []) as { mt_license_expiry: string | null }[]) {
    const status = expiryStatus(row.mt_license_expiry)
    if (status === 'expired') staffLicenseExpired++
    else if (status === 'expiring') staffLicenseExpiring++
  }

  let staffCompetencyOverdue = 0
  let staffCompetencyDueSoon = 0
  for (const row of (staffCompetencyResult.data ?? []) as { next_due_date: string | null }[]) {
    const status = expiryStatus(row.next_due_date)
    if (status === 'expired') staffCompetencyOverdue++
    else if (status === 'expiring') staffCompetencyDueSoon++
  }

  const testCount    = testActiveResult.count ?? 0
  const testTotal    = testTotalResult.count ?? 0
  const staffTotal   = staffTotalResult.count ?? 0
  const staffMt      = staffMtResult.count ?? 0
  const docTotal     = docTotalResult.count ?? 0
  const docPublished = docPublishedResult.count ?? 0
  const docNew       = docNewResult.count ?? 0

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
        .priority-grid{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,6fr);gap:16px}
        .priority-card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.05)}
        .priority-link{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:0 12px;border-radius:9px;text-decoration:none;font-size:12px;font-weight:800;transition:background-color .18s,color .18s,border-color .18s}
        .priority-link--primary:hover{background:#166534;box-shadow:0 6px 14px rgba(21,128,61,.22)}
        .priority-link--secondary:hover{background:var(--primary-soft);border-color:color-mix(in srgb,var(--primary) 30%,var(--border))!important;color:var(--primary)!important}
        .priority-link:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 38%,transparent);outline-offset:2px}
        .schedule-row{transition:background-color .18s,border-color .18s}
        .schedule-row:hover{background:var(--primary-soft)!important;border-color:color-mix(in srgb,var(--primary) 25%,var(--border))!important}
        @keyframes dashFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .dash-fade{animation:dashFadeUp .5s cubic-bezier(.22,1,.36,1) backwards}
        @media (prefers-reduced-motion: reduce){.dash-fade{animation:none}}
        @media(max-width:767px){
          .dash-kpi-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
          .dash-attention-grid{grid-template-columns:repeat(2,1fr)!important}
          .dash-main-grid{grid-template-columns:1fr!important;align-items:start!important}
          .priority-grid{grid-template-columns:1fr!important}
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
              <span className="live-label" style={{ color:'rgba(255,255,255,.45)',fontSize:10.5,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' }}>
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

        <OperationalFocus
          showKpi={canSeeKpi}
          kpiPeriodLabel={kpiPeriodLabel}
          kpiDeadlineLabel={kpiDeadlineLabel}
          kpiDaysRemaining={kpiDaysRemaining}
          kpiCompletion={kpiCompletion}
          kpiFilled={kpiFilled}
          kpiRequired={kpiRequired}
          kpiCompleteDepartments={kpiCompleteDepartments}
          kpiDepartmentCount={kpiDepartments.length}
          kpiIncompleteDepartments={kpiIncompleteDepartments.map(row => ({
            name: row.dept_name,
            filled: row.months[kpiPeriod.month].filled,
            required: row.months[kpiPeriod.month].required,
          }))}
          showQuality={qualityLevel !== 'none'}
          qualityUpcoming={qualityUpcoming}
          qualityUrgent={qualityTasks.slice(0, 3)}
        />

        {/* ══ ATTENTION QUEUE ══ */}
        <div className="dash-fade" style={{ animationDelay: '.22s' }}>
          <AttentionQueue
            pendingDocs={pendingDocs}
            totalPendingDocs={pendingDocs.length}
            contracts={criticalContractsAll}
            totalContracts={criticalContractsAll.length}
            staffLicenseExpired={staffLicenseExpired}
            staffLicenseExpiring={staffLicenseExpiring}
            staffCompetencyOverdue={staffCompetencyOverdue}
            staffCompetencyDueSoon={staffCompetencyDueSoon}
            permissions={permissions}
          />
        </div>

        {/* ══ RECENT ACTIVITY ══ */}
        <div className="dash-main-grid dash-fade" style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(260px,1fr)', gap:16, alignItems:'stretch', animationDelay:'.26s' }}>

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

          <DashboardQuickActions permissions={permissions} />

        </div>

        {/* ══ ANALYTICS ══ */}
        <div className="dash-fade" style={{ animationDelay: '.44s' }}>
          <AnalyticsTabs />
        </div>

      </div>
    </>
  )
}

/* ──────────────── COMPONENTS ──────────────── */

function OperationalFocus({
  showKpi, kpiPeriodLabel, kpiDeadlineLabel, kpiDaysRemaining, kpiCompletion,
  kpiFilled, kpiRequired, kpiCompleteDepartments, kpiDepartmentCount, kpiIncompleteDepartments,
  showQuality, qualityUpcoming, qualityUrgent,
}: {
  showKpi: boolean
  kpiPeriodLabel: string
  kpiDeadlineLabel: string
  kpiDaysRemaining: number
  kpiCompletion: number
  kpiFilled: number
  kpiRequired: number
  kpiCompleteDepartments: number
  kpiDepartmentCount: number
  kpiIncompleteDepartments: { name: string; filled: number; required: number }[]
  showQuality: boolean
  qualityUpcoming: QualityTaskOccurrence[]
  qualityUrgent: QualityTaskOccurrence[]
}) {
  if (!showKpi && !showQuality) return null

  const completionState = getKpiCompletionState(kpiFilled, kpiRequired, kpiDaysRemaining)
  const { isComplete: kpiDone, accent: deadlineColor, badgeBackground: deadlineBg, badgeText: deadlineText } = completionState
  const overallProgressColor = getKpiProgressColor(kpiRequired > 0 ? (kpiFilled / kpiRequired) * 100 : 100)

  return (
    <section className="dash-fade" style={{ animationDelay:'.21s' }} aria-labelledby="priority-heading">
      <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:12,marginBottom:10 }}>
        <div>
          <h2 id="priority-heading" style={{ margin:0,fontSize:16,fontWeight:850,color:'var(--ink)' }}>สิ่งที่ต้องทำ</h2>
          <p style={{ margin:'3px 0 0',fontSize:11.5,color:'var(--muted)' }}>ติดตามการบันทึก KPI และกำหนดการงานคุณภาพจากข้อมูลล่าสุด</p>
        </div>
      </div>
      <div className="priority-grid" style={{ gridTemplateColumns:showKpi&&showQuality?undefined:'1fr' }}>
        {showKpi && (
          <article className="priority-card" style={{ borderTop:`3px solid ${deadlineColor}`,display:'flex',flexDirection:'column',height:470,minHeight:470 }}>
            <div style={{ padding:'16px 18px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface-2)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10,minWidth:0 }}>
                <span style={{ width:34,height:34,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(22,163,74,.12)',color:'#15803D',flexShrink:0 }}><Icon name="chart" size={17}/></span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13.5,fontWeight:850,color:'var(--ink)' }}>บันทึก KPI · {kpiPeriodLabel}</div>
                  <div style={{ marginTop:2,fontSize:11,color:'var(--muted)' }}>กำหนดส่งไม่เกิน {kpiDeadlineLabel}</div>
                </div>
              </div>
              <span style={{ flexShrink:0,padding:'5px 9px',borderRadius:999,background:deadlineBg,color:deadlineColor,fontSize:10.5,fontWeight:850 }}>{deadlineText}</span>
            </div>
            <div style={{ padding:'17px 18px 18px',display:'flex',flexDirection:'column',flex:1 }}>
              <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:12 }}>
                <div>
                  <div className="dmono" style={{ fontSize:34,fontWeight:800,lineHeight:1,color:deadlineColor }}>{kpiCompletion}%</div>
                  <div style={{ marginTop:5,fontSize:11.5,color:'var(--muted)' }}>ครบ {kpiFilled}/{kpiRequired} รายการ</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:18,fontWeight:850,color:'var(--ink)' }}>{kpiCompleteDepartments}/{kpiDepartmentCount}</div>
                  <div style={{ fontSize:10.5,color:'var(--muted)' }}>หน่วยงานบันทึกครบ</div>
                </div>
              </div>
              <div role="progressbar" aria-label="ความครบถ้วนการบันทึก KPI" aria-valuemin={0} aria-valuemax={100} aria-valuenow={kpiCompletion} style={{ height:9,marginTop:13,borderRadius:999,overflow:'hidden',background:'var(--surface-2)' }}>
                <div style={{ width:`${Math.min(100,kpiCompletion)}%`,height:'100%',borderRadius:999,background:overallProgressColor,transition:'width .3s ease' }}/>
              </div>
              {kpiDone ? (
                <div role="status" aria-live="polite" style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'18px 0 6px' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12,maxWidth:350,padding:'14px 16px',border:'1px solid #BBF7D0',borderRadius:12,background:'#F0FDF4' }}>
                    <span aria-hidden="true" style={{ width:38,height:38,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:'#DCFCE7',color:'#15803D',flexShrink:0 }}><Icon name="check" size={22} stroke={2.2}/></span>
                    <div>
                      <div style={{ fontSize:13,fontWeight:850,color:'#166534' }}>{completionState.successTitle}</div>
                      <div style={{ marginTop:3,fontSize:11,color:'#3F6B50' }}>{completionState.successDetail}</div>
                    </div>
                  </div>
                </div>
              ) : kpiIncompleteDepartments.length > 0 && (
                <div style={{ marginTop:15,padding:'11px 12px',border:'1px solid var(--border)',borderRadius:10,background:'var(--surface-2)' }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:9 }}>
                    <div style={{ fontSize:10.5,fontWeight:850,color:'var(--muted)' }}>ความครบถ้วนรายหน่วยงาน</div>
                    <div style={{ fontSize:10.5,fontWeight:800,color:deadlineColor }}>เหลือ {kpiRequired-kpiFilled} รายการ</div>
                  </div>
                  <div style={{ display:'grid',gap:9,maxHeight:172,overflowY:'auto',paddingRight:4 }}>
                    {kpiIncompleteDepartments.map(dept=>{const percent=Math.round((dept.filled/dept.required)*100);const progressColor=getKpiProgressColor(percent);return <div key={dept.name}><div style={{ display:'flex',justifyContent:'space-between',gap:10,marginBottom:4,fontSize:10.5 }}><span style={{ minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:700,color:'var(--ink)' }}>{dept.name}</span><span style={{ flexShrink:0,color:'var(--muted)' }}>{dept.filled}/{dept.required} · {percent}%</span></div><div role="progressbar" aria-label={`ความครบถ้วน ${dept.name}: ${percent}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={{ height:5,borderRadius:99,overflow:'hidden',background:'var(--border)' }}><div style={{ width:`${percent}%`,height:'100%',borderRadius:99,background:progressColor }}/></div></div>})}
                  </div>
                </div>
              )}
              <div style={{ display:'flex',gap:8,marginTop:'auto',paddingTop:16 }}>
                <Link href="/kpi/input" className="priority-link priority-link--primary" style={{ background:'#15803D',color:'#fff' }}><Icon name="edit" size={14}/>บันทึก KPI</Link>
                <Link href="/kpi/dashboard" className="priority-link priority-link--secondary" style={{ border:'1px solid var(--border)',color:'var(--ink)',background:'var(--card)' }}>ดูภาพรวม</Link>
              </div>
            </div>
          </article>
        )}

        {showQuality && (
          <article className="priority-card" style={{ borderTop:'3px solid #0891B2' }}>
            <div style={{ padding:'16px 18px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface-2)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <span style={{ width:34,height:34,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(8,145,178,.12)',color:'#0891B2',flexShrink:0 }}><Icon name="calendar" size={17}/></span>
                <div>
                  <div style={{ fontSize:13.5,fontWeight:850,color:'var(--ink)' }}>งานคุณภาพที่ต้องติดตาม</div>
                  <div style={{ marginTop:2,fontSize:11,color:'var(--muted)' }}>งานเร่งด่วนและกำหนดการ 7 วันข้างหน้า</div>
                </div>
              </div>
              {qualityUrgent.length>0&&<span style={{ flexShrink:0,padding:'5px 9px',borderRadius:999,background:qualityUrgent.some(task=>task.urgency==='overdue')?'#FEE2E2':'#FEF3C7',color:qualityUrgent.some(task=>task.urgency==='overdue')?'#DC2626':'#B45309',fontSize:10.5,fontWeight:850 }}>{qualityUrgent.length} งานต้องติดตาม</span>}
            </div>
            <div style={{ padding:'12px 14px 14px' }}>
              {qualityUrgent.length>0&&<div style={{ display:'grid',gap:6,marginBottom:12 }}><div style={{ fontSize:10.5,fontWeight:850,color:'var(--muted)' }}>เร่งด่วน</div>{qualityUrgent.map(task=><Link key={task.key} href="/staff/quality-tasks" className="schedule-row" style={{ display:'grid',gridTemplateColumns:'6px minmax(0,1fr) auto',alignItems:'center',gap:8,padding:'7px 9px',border:'1px solid var(--border)',borderRadius:9,background:task.urgency==='overdue'?'#FFF7F7':'#FFFBEB',textDecoration:'none' }}><span style={{ width:6,height:28,borderRadius:99,background:task.urgency==='overdue'?'#DC2626':'#D97706' }}/><span style={{ minWidth:0 }}><span style={{ display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11.5,fontWeight:800,color:'var(--ink)' }}>{task.template.title}</span><span style={{ display:'block',marginTop:2,fontSize:10,color:task.urgency==='overdue'?'#B91C1C':'#B45309',fontWeight:700 }}>{task.urgency==='overdue'?'เกินกำหนด':'ใกล้กำหนด'} · {new Date(`${task.effectiveDueDate}T00:00:00+07:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone:'Asia/Bangkok'})}</span></span><Icon name="chevRight" size={13} style={{ color:'var(--muted)' }}/></Link>)}</div>}
              {qualityUrgent.length > 0 && (
                <div style={{ height:1,background:'var(--border)',margin:'2px 0 10px' }}/>
              )}
              <div style={{ fontSize:10.5,fontWeight:850,color:'var(--muted)',marginBottom:7 }}>กำหนดการ 7 วันข้างหน้า</div>
              {qualityUpcoming.length > 0 ? (
                <div style={{ display:'grid',gap:7 }}>
                  {qualityUpcoming.map(task => {
                    const taskDate = new Date(`${task.effectiveDueDate}T00:00:00+07:00`)
                    const scheduleTitle = qualityScheduleTitle(task)
                    return <Link key={task.key} href="/staff/quality-tasks" className="schedule-row" style={{ display:'grid',gridTemplateColumns:'46px minmax(0,1fr) auto',alignItems:'center',gap:10,padding:'9px 10px',border:'1px solid var(--border)',borderRadius:10,background:'var(--card)',textDecoration:'none' }}>
                      <span style={{ height:42,borderRadius:9,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'var(--primary-soft)',color:'#0E7490' }}><b className="dmono" style={{ fontSize:15,lineHeight:1 }}>{taskDate.toLocaleDateString('th-TH',{day:'numeric',timeZone:'Asia/Bangkok'})}</b><small style={{ fontSize:9.5,marginTop:3 }}>{taskDate.toLocaleDateString('th-TH',{month:'short',timeZone:'Asia/Bangkok'})}</small></span>
                      <span style={{ minWidth:0 }}><span style={{ display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12.5,fontWeight:800,color:'var(--ink)' }}>{scheduleTitle}</span><span style={{ display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2,fontSize:10.5,color:'var(--muted)' }}>{task.template.ownerText}</span></span>
                      <Icon name="chevRight" size={14} style={{ color:'var(--muted)' }}/>
                    </Link>
                  })}
                </div>
              ) : <div style={{ minHeight:150,display:'flex',alignItems:'center',justifyContent:'center' }}><Empty text="ไม่มีกำหนดการใน 7 วันข้างหน้า" icon="calendar" /></div>}
              <Link href="/staff/quality-tasks" className="priority-link" style={{ width:'100%',marginTop:10,border:'1px solid var(--border)',color:'#0E7490',background:'var(--surface-2)' }}>ดูปฏิทินทั้งหมด <Icon name="arrowRight" size={14}/></Link>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}

function DashboardQuickActions({ permissions }: { permissions: Permissions }) {
  const actions = [
    ...((permissions['เอกสารคุณภาพ'] ?? 'none') !== 'none' ? [{ href:'/staff/documents/categories', icon:'doc', title:'เอกสารคุณภาพ', detail:'จัดการหมวดหมู่เอกสารคุณภาพ', color:'#0D9488' }] : []),
    ...((permissions['งานคุณภาพ'] ?? 'none') === 'edit' ? [{ href:'/staff/quality-tasks?create=1', icon:'calendar', title:'สร้างงานเฉพาะกิจ', detail:'เพิ่มงานคุณภาพนอกแผน', color:'#0891B2' }] : []),
    ...((permissions['เอกสารคุณภาพ'] ?? 'none') === 'edit' ? [{ href:'/staff/documents?create=1', icon:'doc', title:'สร้าง Draft เอกสาร', detail:'เริ่มจัดทำเอกสารฉบับใหม่', color:'#0D9488' }] : []),
    ...((permissions['ข่าวสาร'] ?? 'none') === 'edit' ? [{ href:'/staff/news?create=1', icon:'bell', title:'สร้างข่าวใหม่', detail:'ประกาศข่าวสารภายในหน่วยงาน', color:'#4338CA' }] : []),
    ...((permissions['รายการตรวจ'] ?? 'none') === 'edit' ? [{ href:'/staff/tests/new', icon:'plus', title:'เพิ่มรายการตรวจ', detail:'สร้างรายการตรวจวิเคราะห์ใหม่', color:'#EA580C' }] : []),
    ...((permissions['ทะเบียนเครื่องมือ'] ?? 'none') === 'edit' ? [{ href:'/staff/equipment?create=1', icon:'microscope', title:'เพิ่มเครื่องมือ', detail:'ลงทะเบียนเครื่องมือใหม่', color:'#7C3AED' }] : []),
    ...((permissions['สัญญา'] ?? 'none') === 'edit' ? [{ href:'/staff/contracts?create=1', icon:'building', title:'เพิ่มสัญญาใหม่', detail:'บันทึกข้อมูลสัญญาและงบประมาณ', color:'#7C3AED' }] : []),
  ]
  return <aside style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column' }} aria-label="ทางลัด">
    <div style={{ padding:'14px 16px 12px',borderBottom:'1px solid var(--border)',background:'var(--surface-2)',display:'flex',alignItems:'center',gap:10 }}>
      <span style={{ width:30,height:30,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(124,58,237,.12)',color:'#7C3AED' }}><Icon name="dash" size={15}/></span>
      <div><div style={{ fontSize:13,fontWeight:850,color:'var(--ink)' }}>ทางลัด</div><div style={{ marginTop:1,fontSize:10.5,color:'var(--muted)' }}>ไปยังงานที่ใช้บ่อย</div></div>
    </div>
    <nav style={{ display:'grid',gap:8,padding:12 }}>
      {actions.map(action=><Link key={action.href} href={action.href} className="schedule-row" style={{ display:'flex',alignItems:'center',gap:10,padding:'10px',border:'1px solid var(--border)',borderRadius:10,background:'var(--card)',textDecoration:'none' }}>
        <span style={{ width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:`${action.color}18`,color:action.color,flexShrink:0 }}><Icon name={action.icon} size={15}/></span>
        <span style={{ minWidth:0,flex:1 }}><span style={{ display:'block',fontSize:12,fontWeight:800,color:'var(--ink)' }}>{action.title}</span><span style={{ display:'block',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:10.5,color:'var(--muted)' }}>{action.detail}</span></span>
        <Icon name="chevRight" size={14} style={{ color:'var(--muted)' }}/>
      </Link>)}
    </nav>
  </aside>
}

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
  'document.import_current':                      'นำเข้าเอกสารฉบับปัจจุบัน (Legacy)',
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
  // เอกสาร — DCC Tools (ISO 15189 8.3)
  'document.review_confirmed':                    'ยืนยันทบทวนเอกสารประจำปี',
  'document.annual_review':                       'บันทึกทบทวนประจำปี (ไม่มีการแก้ไข)',
  'document.obsolete_stamp':                      'ประทับตรา OBSOLETE บนเอกสาร',
  'document.footer_stamp':                        'ประทับ Metadata หน้าเอกสารใหม่',
  'document.read_audience_bulk':                  'ตั้งค่ากลุ่มผู้อ่านเอกสาร (กลุ่ม)',
  // เครื่องมือ
  'equipment.create':                             'เพิ่มเครื่องมือ',
  'equipment.update':                             'แก้ไขเครื่องมือ',
  'equipment.delete':                             'ลบเครื่องมือ',
  'equipment.permission.update':                  'แก้ไขสิทธิ์ผู้แก้ไขเครื่องมือ',
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
  'kpi.settings':                                 'ตั้งค่ารายการ KPI',
  // งานคุณภาพ
  'quality_task.attachment.upload':               'อัปโหลดไฟล์แนบงานคุณภาพ',
  'quality_task.attachment.delete':               'ลบไฟล์แนบงานคุณภาพ',
  'quality_task.instance.create':                 'สร้างงานเฉพาะกิจ (งานคุณภาพ)',
  'quality_task.instance.materialize':             'ระบบสร้างงานตามรอบ (งานคุณภาพ)',
  'quality_task.instance.schedule':                'กำหนดวัน/แก้ไขรายละเอียด (งานคุณภาพ)',
  'quality_task.instance.complete':                'ทำงานคุณภาพเสร็จ',
  'quality_task.instance.reopen':                  'เปิดงานคุณภาพใหม่',
  'quality_task.instance.cancel':                  'ยกเลิกรอบงานคุณภาพ',
  'quality_task.instance.delete':                  'ลบงานคุณภาพเฉพาะกิจ',
  'quality_task.template.create':                 'เพิ่มกิจกรรมคุณภาพ (ทะเบียนกิจกรรม)',
  'quality_task.template.update':                 'แก้ไขกิจกรรมคุณภาพ (ทะเบียนกิจกรรม)',
  'quality_task.template.delete':                  'ลบกิจกรรมคุณภาพ (ทะเบียนกิจกรรม)',
  // ข่าวสาร
  'create_news':                                  'เพิ่มข่าวสาร',
  'update_news':                                  'แก้ไขข่าวสาร',
  'delete_news':                                  'ลบข่าวสาร',
  'line_broadcast_news':                          'ส่งข่าวสารผ่าน LINE OA',
  // บุคลากร
  'personnel.profile.update':                     'แก้ไขโปรไฟล์บุคลากร',
  'personnel.org.create':                         'เพิ่มโครงสร้างองค์กร',
  'personnel.org.delete':                         'ลบโครงสร้างองค์กร',
  'personnel.jd.create':                          'เพิ่มข้อกำหนดตำแหน่งงาน',
  'personnel.jd.update':                          'แก้ไขข้อกำหนดตำแหน่งงาน',
  // บุคลากร — สมรรถนะ / อบรม / ใบรับรอง / มอบหมายงาน
  'personnel.staff_competencies.create':           'เพิ่มรายการประเมินสมรรถนะ',
  'personnel.staff_competencies.update':           'แก้ไขรายการประเมินสมรรถนะ',
  'personnel.staff_competencies.delete':           'ลบรายการประเมินสมรรถนะ',
  'personnel.competency_signoff':                  'ลงนามรับรองสมรรถนะ (Sign-off)',
  'personnel.staff_training.create':               'เพิ่มประวัติการอบรม',
  'personnel.staff_training.update':               'แก้ไขประวัติการอบรม',
  'personnel.staff_training.delete':               'ลบประวัติการอบรม',
  'personnel.staff_training_plan.create':          'เพิ่มแผนการอบรม',
  'personnel.staff_training_plan.update':          'แก้ไขแผนการอบรม',
  'personnel.staff_training_plan.delete':          'ลบแผนการอบรม',
  'personnel.staff_certifications.create':         'เพิ่มใบรับรอง/ใบอนุญาต',
  'personnel.staff_certifications.update':         'แก้ไขใบรับรอง/ใบอนุญาต',
  'personnel.staff_certifications.delete':         'ลบใบรับรอง/ใบอนุญาต',
  'personnel.staff_authorizations.create':         'เพิ่มการมอบหมายงาน (Authorization)',
  'personnel.staff_authorizations.update':         'แก้ไขการมอบหมายงาน (Authorization)',
  'personnel.staff_authorizations.delete':         'ลบการมอบหมายงาน (Authorization)',
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
  'delete':                                       'ล้างประวัติการอ่านเอกสาร',
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

