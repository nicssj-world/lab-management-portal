import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { getStaffRoster } from '@/lib/queries/personnel'
import { MAIN_PERSONNEL_ROLES, mainPersonnelRole, type MainPersonnelRole } from '@/lib/personnel/roles'
import { firstFilledWorkforceLabel, sortWorkforceRowsDescending } from '@/lib/personnel/workforce'

type CountRow = {
  label: string
  value: number
}

type ChartRow = CountRow & {
  color: string
}

const ROLE_LABEL_TH: Record<MainPersonnelRole | 'Other', string> = {
  'Medical Technologist': 'นักเทคนิคการแพทย์',
  'Medical Science Technician': 'นักวิทยาศาสตร์การแพทย์',
  Assistant: 'ผู้ช่วย / พนักงานห้องทดลอง',
  Other: 'อื่นๆ',
}

const ROLE_ACCENT: Record<MainPersonnelRole | 'Other', string> = {
  'Medical Technologist': '#1E5FAD',
  'Medical Science Technician': '#0F766E',
  Assistant: '#7C3AED',
  Other: '#64748B',
}

const CHART_PALETTE = ['#1E5FAD', '#0F766E', '#7C3AED', '#D97706', '#0891B2', '#64748B', '#DC2626', '#059669']

export default async function WorkforceDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const roster = await getStaffRoster()
  const total = roster.length
  const roleCounts = new Map<MainPersonnelRole | 'Other', number>()
  const unitCounts = new Map<string, number>()
  const employmentCounts = new Map<string, number>()
  const educationCounts = new Map<string, number>()
  const positionCounts = new Map<string, number>()

  for (const role of MAIN_PERSONNEL_ROLES) roleCounts.set(role, 0)
  roleCounts.set('Other', 0)

  for (const p of roster) {
    const role = mainPersonnelRole(p.role) ?? 'Other'
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
    addCount(unitCounts, firstFilledWorkforceLabel('ไม่ระบุหน่วยงาน', p.dept, p.unit))
    addCount(employmentCounts, firstFilledWorkforceLabel('ไม่ระบุประเภทการจ้าง', p.employment_type))
    addCount(educationCounts, firstFilledWorkforceLabel('ไม่ระบุวุฒิการศึกษา', p.education))
    addCount(positionCounts, firstFilledWorkforceLabel('ไม่ระบุตำแหน่ง', p.position_title))
  }

  const roleRows = [...roleCounts.entries()]
    .map(([role, value]) => ({ role, label: ROLE_LABEL_TH[role], value, color: ROLE_ACCENT[role] }))
    .filter((r) => r.value > 0 || r.role !== 'Other')
  const unitRows = toRows(unitCounts)
  const employmentRows = toRows(employmentCounts)
  const educationRows = toRows(educationCounts)
  const positionRows = toRows(positionCounts)
  const roleChartRows = sortWorkforceRowsDescending(roleRows.map((r) => ({ label: r.label, value: r.value, color: r.color })))
  const employmentChartRows = withPalette(employmentRows, 5)
  const educationChartRows = withPalette(educationRows, 4)
  const positionChartRows = withPalette(positionRows, 2)
  const unitChartRows = withPalette(unitRows, 0)
  const largestUnit = unitRows[0]
  const largestRole = roleChartRows.slice().sort((a, b) => b.value - a.value)[0]
  const generatedAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/staff/personnel" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>
            <Icon name="arrowLeft" size={16} /> บุคลากร
          </Link>
          <PageHeader
            eyebrow="อัตรากำลัง"
            title="Dashboard อัตรากำลังบุคลากร"
            subtitle={`ข้อมูลจากทะเบียนบุคลากร · อัปเดต ${generatedAt}`}
            marginBottom={0}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.15fr) minmax(320px, .85fr)', gap: 14 }}>
        <Card padding={0}>
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            minHeight: 158,
            padding: 22,
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(30,95,173,.12), rgba(255,255,255,.92) 46%, rgba(15,118,110,.08))',
          }}>
            <div style={{ position: 'absolute', right: -52, top: -58, width: 190, height: 190, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,95,173,.18), transparent 68%)' }} />
            <div style={{ position: 'relative', display: 'grid', gap: 16 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,.72)', color: 'var(--primary)', fontSize: 11, fontWeight: 800, border: '1px solid rgba(30,95,173,.14)' }}>
                  <Icon name="chart" size={13} /> Workforce Snapshot
                </div>
                <div style={{ marginTop: 12, color: 'var(--ink)', fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{total}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>บุคลากรทั้งหมดในทะเบียน</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SnapshotPill label="กลุ่มบุคลากรหลัก" value={largestRole?.label ?? '—'} color={largestRole?.color ?? '#1E5FAD'} />
                <SnapshotPill label="หน่วยงานใหญ่สุด" value={largestUnit?.label ?? '—'} color="#D97706" />
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <Metric label="บทบาทหลัก" value={roleRows.filter((r) => r.value > 0).length} icon="shieldCheck" color="#0F766E" />
          <Metric label="หน่วยงาน" value={unitRows.length} icon="building" color="#7C3AED" />
          <Metric label="ประเภทการจ้าง" value={employmentRows.length} icon="doc" color="#64748B" />
          <Metric label="ตำแหน่ง" value={positionRows.length} icon="user" color="#9333EA" />
          <Metric label="วุฒิการศึกษา" value={educationRows.length} icon="book" color="#0891B2" />
          <Metric label="หน่วยงานใหญ่สุด" value={largestUnit ? largestUnit.value : 0} hint={largestUnit?.label ?? '—'} icon="chart" color="#D97706" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <DonutCard icon="chart" title="สัดส่วนตามบทบาทหลัก" subtitle="มองภาพรวมกำลังคนตามกลุ่มงานวิชาชีพ" rows={roleChartRows} total={total} centerLabel="บทบาท" />
        <DonutCard icon="doc" title="ประเภทการจ้าง" subtitle="แจกแจงตามประเภทการจ้างที่บันทึกไว้" rows={employmentChartRows} total={total} centerLabel="การจ้าง" />
        <DonutCard icon="book" title="วุฒิการศึกษา" subtitle="แจกแจงตามวุฒิการศึกษาที่บันทึกไว้" rows={educationChartRows} total={total} centerLabel="วุฒิ" />
        <BarListCard icon="user" title="ตำแหน่ง" subtitle="แจกแจงตามตำแหน่งที่บันทึกไว้" rows={positionChartRows} total={total} />
        <BarListCard icon="building" title="หน่วยงาน / พื้นที่ปฏิบัติงาน" subtitle="เรียงตามจำนวนบุคลากร" rows={unitChartRows} total={total} />
      </div>
    </div>
  )
}

function addCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function toRows(map: Map<string, number>): CountRow[] {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'th'))
}

function withPalette(rows: CountRow[], offset = 0): ChartRow[] {
  return rows.map((row, index) => ({
    ...row,
    color: CHART_PALETTE[(index + offset) % CHART_PALETTE.length],
  }))
}

function SnapshotPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '7px 10px', borderRadius: 999, background: 'rgba(255,255,255,.72)', border: `1px solid ${color}26`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.80)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontSize: 11.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{value}</span>
    </div>
  )
}

function Metric({ label, value, hint, icon, color }: { label: string; value: string | number; hint?: string; icon: string; color: string }) {
  return (
    <Card padding={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}14`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={19} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--ink)', fontSize: 26, lineHeight: 1, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 4 }}>{label}</div>
          {hint && <div style={{ color, fontSize: 11, marginTop: 2, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{hint}</div>}
        </div>
      </div>
    </Card>
  )
}

function SectionTitle({ icon, title, subtitle, compact }: { icon: string; title: string; subtitle: string; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: compact ? 'center' : 'flex-start', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 750 }}>{title}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{subtitle}</div>
      </div>
    </div>
  )
}

function DonutCard({ icon, title, subtitle, rows, total, centerLabel }: { icon: string; title: string; subtitle: string; rows: ChartRow[]; total: number; centerLabel: string }) {
  const activeRows = rows.filter((row) => row.value > 0)
  const top = activeRows.slice().sort((a, b) => b.value - a.value)[0]
  const topPercent = top && total ? Math.round((top.value / total) * 100) : 0

  return (
    <Card padding={18}>
      <SectionTitle icon={icon} title={title} subtitle={subtitle} />
      <div style={{ display: 'grid', gridTemplateColumns: '138px minmax(0, 1fr)', gap: 18, alignItems: 'center', marginTop: 18 }}>
        <div
          role="img"
          aria-label={`${title} รวม ${total} คน`}
          style={{
            width: 138,
            height: 138,
            borderRadius: '50%',
            background: donutGradient(activeRows, total),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.60), 0 12px 28px rgba(15,23,42,.08)',
          }}
        >
          <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 1px var(--border)' }}>
            <div style={{ color: top?.color ?? 'var(--primary)', fontSize: 22, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{topPercent}%</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, marginTop: 3 }}>{centerLabel}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          {activeRows.map((row) => <LegendRow key={row.label} row={row} total={total} />)}
          {activeRows.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>ไม่มีข้อมูลที่บันทึกไว้</div>}
        </div>
      </div>
    </Card>
  )
}

function LegendRow({ row, total }: { row: ChartRow; total: number }) {
  const percent = total ? Math.round((row.value / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', fontSize: 12.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
      <span style={{ color: 'var(--muted)', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
      <span style={{ color: row.color, fontSize: 12.5, fontWeight: 850, minWidth: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
    </div>
  )
}

function BarListCard({ icon, title, subtitle, rows, total }: { icon: string; title: string; subtitle: string; rows: ChartRow[]; total: number }) {
  return (
    <Card padding={18}>
      <SectionTitle icon={icon} title={title} subtitle={subtitle} />
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {rows.map((row) => <BarListRow key={row.label} row={row} total={total} />)}
        {rows.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>ไม่มีข้อมูลที่บันทึกไว้</div>}
      </div>
    </Card>
  )
}

function BarListRow({ row, total }: { row: ChartRow; total: number }) {
  const percent = total ? Math.round((row.value / total) * 100) : 0
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ minWidth: 0, color: 'var(--ink)', fontSize: 12.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
        <span style={{ color: row.color, fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.value} คน · {percent}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, minWidth: row.value > 0 ? 7 : 0, height: '100%', borderRadius: 99, background: row.color }} />
      </div>
    </div>
  )
}

function donutGradient(rows: ChartRow[], total: number) {
  if (!total || rows.length === 0) return 'var(--surface-2)'

  let cursor = 0
  const segments = rows.map((row) => {
    const start = cursor
    cursor += (row.value / total) * 100
    return `${row.color} ${start}% ${cursor}%`
  })

  if (cursor < 100) segments.push(`var(--surface-2) ${cursor}% 100%`)
  return `conic-gradient(${segments.join(', ')})`
}
