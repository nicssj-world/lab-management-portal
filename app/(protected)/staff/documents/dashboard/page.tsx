import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { getSourceUploadedDocumentIds } from '@/lib/documents/pending'
import { Stat } from '@/components/ui/Stat'
import { Icon } from '@/components/ui/Icon'

export const dynamic = 'force-dynamic'

const DOCUMENT_WORKFLOW_ACCESS_ROLES = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer', 'Viewer']

interface DashDoc {
  id: string
  document_code: string
  title: string
  type: string
  status: string
  department: string | null
  revision: string | null
  expiry_date: string | null
  updated_at: string
}

const TYPE_ORDER = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others']
const TYPE_LABEL: Record<string, string> = {
  QP: 'ระเบียบปฏิบัติ (QP)', WI: 'วิธีปฏิบัติงาน (WI)', Form: 'แบบฟอร์ม (Form)',
  Policy: 'นโยบาย (Policy)', Manual: 'คู่มือ (Manual)', Record: 'บันทึกคุณภาพ (Record)',
  Reference: 'เอกสารอ้างอิง (Reference)', 'Card file': 'Card file', Others: 'อื่นๆ',
}
const STATUS_META: { key: string; th: string; color: string }[] = [
  { key: 'Draft',     th: 'ฉบับร่าง',        color: '#64748B' },
  { key: 'Review',    th: 'อยู่ระหว่างทบทวน', color: '#D97706' },
  { key: 'Approved',  th: 'รออนุมัติเผยแพร่',  color: '#1E5FAD' },
  { key: 'Published', th: 'บังคับใช้',         color: '#16A34A' },
  { key: 'Obsolete',  th: 'ยกเลิกใช้งาน',     color: '#DC2626' },
]
const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  Draft:     { bg: 'rgba(100,116,139,.12)', color: '#475569' },
  Review:    { bg: 'rgba(217,119,6,.12)',   color: '#B45309' },
  Approved:  { bg: 'rgba(30,95,173,.12)',   color: '#1E5FAD' },
  Published: { bg: 'rgba(22,163,74,.12)',   color: '#15803D' },
  Obsolete:  { bg: 'rgba(220,38,38,.12)',   color: '#DC2626' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

// SVG donut segments via stroke-dasharray on circles
function Donut({ counts, total }: { counts: { color: string; value: number }[]; total: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <svg viewBox="0 0 120 120" style={{ width: 168, height: 168, flexShrink: 0 }}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
      {total > 0 && counts.filter((c) => c.value > 0).map((c, i) => {
        const frac = c.value / total
        const seg = (
          <circle
            key={i}
            cx="60" cy="60" r={R} fill="none"
            stroke={c.color} strokeWidth="14"
            strokeDasharray={`${frac * C} ${C - frac * C}`}
            strokeDashoffset={-offset * C + C / 4}
          />
        )
        offset += frac
        return seg
      })}
      <text x="60" y="57" textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: 'var(--ink)' }}>{total}</text>
      <text x="60" y="74" textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--muted)' }}>ทั้งหมด</text>
    </svg>
  )
}

function SectionCard({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        {extra}
      </div>
      {children}
    </div>
  )
}

export default async function DocumentsDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase
    .from('profiles').select('role, doc_role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  const hasWorkflowAccess = DOCUMENT_WORKFLOW_ACCESS_ROLES.includes(actor?.doc_role ?? '')
  if (!hasWorkflowAccess && (perms['เอกสารคุณภาพ'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const isDcc = actor?.role === 'Admin' || actor?.role === 'Document Controller' || actor?.doc_role === 'Document Controller'

  const [{ data }, dccQueueIds] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('id, document_code, title, type, status, department, revision, expiry_date, updated_at')
      .is('deleted_at', null),
    isDcc ? getSourceUploadedDocumentIds().catch(() => [] as string[]) : Promise.resolve([] as string[]),
  ])
  const docs = (data ?? []) as DashDoc[]

  const total = docs.length
  const byStatus = (s: string) => docs.filter((d) => d.status === s).length
  const published = byStatus('Published')
  const pending = byStatus('Review') + byStatus('Approved')
  const reviewSoon = docs.filter((d) => {
    if (d.status !== 'Published' || !d.expiry_date) return false
    const days = daysUntil(d.expiry_date)
    return days >= 0 && days <= 90
  })
  const reviewOverdue = docs.filter((d) => d.status === 'Published' && d.expiry_date && daysUntil(d.expiry_date) < 0)

  const typeCounts = TYPE_ORDER
    .map((t) => ({ type: t, count: docs.filter((d) => (TYPE_ORDER.includes(d.type) ? d.type : 'Others') === t).length }))
    .filter((t) => t.count > 0)
  const maxTypeCount = Math.max(1, ...typeCounts.map((t) => t.count))

  const statusCounts = STATUS_META.map((s) => ({ ...s, value: byStatus(s.key) }))

  const recent = [...docs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8)
  const expiring = [...reviewOverdue, ...reviewSoon]
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
    .slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: 18, borderRadius: 14, border: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--card) 0%, var(--surface-2) 100%)',
        boxShadow: '0 14px 36px rgba(15,23,42,.08)',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>เอกสารคุณภาพ</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>แดชบอร์ด</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>ภาพรวมระบบควบคุมเอกสาร</div>
        </div>
        <Link href="/staff/documents" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
          fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
        }}>
          <Icon name="doc" size={15} /> เปิดคลังเอกสาร
        </Link>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Stat label="เอกสารทั้งหมด" value={total} color="blue" icon="doc" changeLabel="ทั้งคลังเอกสาร" change="" />
        <Stat
          label="รอดำเนินการ" value={pending + dccQueueIds.length} color="amber" icon="clock"
          change={isDcc && dccQueueIds.length > 0 ? `${dccQueueIds.length}` : undefined}
          changeLabel={isDcc && dccQueueIds.length > 0 ? 'ไฟล์ Word/Excel รอ DCC' : undefined}
        />
        <Stat
          label="ครบกำหนดทบทวนใน 90 วัน" value={reviewSoon.length + reviewOverdue.length} color="red" icon="alert"
          change={reviewOverdue.length > 0 ? `${reviewOverdue.length}` : undefined}
          changeLabel={reviewOverdue.length > 0 ? 'เกินกำหนดแล้ว' : undefined}
        />
        <Stat label="เผยแพร่แล้ว" value={published} color="green" icon="check" changeLabel="เอกสารบังคับใช้" change="" />
      </div>

      {/* Type bars + status donut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <SectionCard title="เอกสารแยกตามประเภท" extra={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>รวม {total} ฉบับ · {typeCounts.length} ประเภท</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {typeCounts.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>ยังไม่มีเอกสาร</div>}
            {typeCounts.map((t) => (
              <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 150, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{TYPE_LABEL[t.type]}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${(t.count / maxTypeCount) * 100}%`, height: '100%', borderRadius: 99, background: 'var(--primary)' }} />
                </div>
                <div style={{ width: 32, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{t.count}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="สถานะเอกสาร">
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <Donut counts={statusCounts.map((s) => ({ color: s.color, value: s.value }))} total={total} />
            <div style={{ flex: 1, minWidth: 170, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {statusCounts.map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--ink)' }}>{s.th}</span>
                  <span style={{ fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Recent + expiring */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <SectionCard
          title="เอกสารล่าสุด"
          extra={<Link href="/staff/documents" style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>ดูทั้งหมด →</Link>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>ยังไม่มีเอกสาร</div>}
            {recent.map((d) => {
              const tone = STATUS_TONE[d.status] ?? STATUS_TONE.Draft
              return (
                <Link key={d.id} href={`/staff/documents?search=${encodeURIComponent(d.document_code)}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, textDecoration: 'none', background: 'var(--surface-2)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{d.document_code}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.bg, padding: '2px 9px', borderRadius: 99, flexShrink: 0 }}>{d.status}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(d.updated_at)}</span>
                </Link>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="ใกล้ครบกำหนดทบทวน"
          extra={(reviewSoon.length + reviewOverdue.length) > 0
            ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B45309', background: 'rgba(217,119,6,.12)', padding: '2px 10px', borderRadius: 99 }}>⚠ {reviewSoon.length + reviewOverdue.length} ฉบับ</span>
            : undefined}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {expiring.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>ไม่มีเอกสารครบกำหนดทบทวนใน 90 วัน</div>}
            {expiring.map((d) => {
              const days = d.expiry_date ? daysUntil(d.expiry_date) : null
              const overdue = days !== null && days < 0
              const urgent = days !== null && days < 30
              const chipColor = overdue || urgent ? '#DC2626' : '#D97706'
              return (
                <Link key={d.id} href={`/staff/documents?search=${encodeURIComponent(d.document_code)}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, textDecoration: 'none', background: 'var(--surface-2)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{d.document_code}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: chipColor }}>
                      {overdue ? `เกิน ${Math.abs(days!)} วัน` : `${days} วัน`}
                    </span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)' }}>{fmtDate(d.expiry_date)}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
