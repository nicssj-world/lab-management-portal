import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { Empty } from '@/components/dashboard/Empty'
import { monthsLeftUntil, isContractExpiring } from '@/lib/dashboard/attention-queue'
import type { PendingApprovalDoc } from '@/lib/documents/pending'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import type { Permissions } from '@/lib/permissions'
import type { QualityTaskOccurrence } from '@/lib/quality-tasks/types'

interface AttentionQueueProps {
  pendingDocs: PendingApprovalDoc[]
  totalPendingDocs: number
  contracts: ContractWithUsage[]
  totalContracts: number
  staffLicenseExpired: number
  staffLicenseExpiring: number
  staffCompetencyOverdue: number
  staffCompetencyDueSoon: number
  permissions: Permissions
}

function QualityTaskRow({ task }: { task: QualityTaskOccurrence }) {
  return <div style={{ padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
    <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.template.title}</div>
    <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{task.periodLabel} · {task.template.ownerText}</div>
    <div style={{ fontSize:10.5, color:task.urgency==='overdue'?'#DC2626':'#D97706', fontWeight:800, marginTop:3 }}>{task.urgency==='overdue'?'เกินกำหนด':'ใกล้กำหนด'} · {new Date(`${task.effectiveDueDate}T00:00:00+07:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</div>
  </div>
}

function daysWaiting(updatedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000))
}

function GroupShell({ title, icon, iconColor, href, count, children }: {
  title: string; icon: string; iconColor: string; href: string; count: number; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
            <Icon name={icon} size={13} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{title}</span>
        </div>
        {count > 0 && (
          <Link href={href} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap', padding: '6px 8px', margin: '-6px -8px', borderRadius: 6 }}>
            ดูทั้งหมด ({count}) →
          </Link>
        )}
      </div>
      <div style={{ padding: '10px 14px' }}>{children}</div>
    </div>
  )
}

function DocumentRow({ doc }: { doc: PendingApprovalDoc }) {
  const days = daysWaiting(doc.updated_at)
  return (
    <Link href={`/staff/documents?open=${doc.id}`} className="attention-document-row" aria-label={`เปิดเอกสาร ${doc.document_code}`} style={{ display: 'block', padding: '8px 9px', margin: '0 -9px', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{doc.document_code}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
      <div style={{ fontSize: 10.5, color: '#B45309', fontWeight: 700, marginTop: 3 }}>รอ {days} วัน</div>
    </Link>
  )
}

function ContractRow({ contract }: { contract: ContractWithUsage }) {
  const total = contract.total ?? 0
  const pct = total > 0 ? Math.min((contract.used / total) * 100, 100) : 0
  const remaining = 100 - pct
  const months = monthsLeftUntil(contract.end_date)
  const isExpiry = isContractExpiring(total, months)
  const isLowBudget = remaining < 30
  const barColor = isExpiry ? '#DC2626' : isLowBudget ? '#D97706' : '#16A34A'
  const tags: string[] = []
  if (isExpiry) tags.push(months <= 0 ? 'หมดอายุแล้ว' : `เหลือ ${months} เดือน`)
  if (isLowBudget) tags.push(`งบเหลือ ${remaining.toFixed(0)}%`)

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 9, marginBottom: 8,
      border: `1px solid ${isExpiry ? '#FECACA' : isLowBudget ? '#FDE68A' : 'var(--border)'}`,
      background: isExpiry ? 'rgba(220,38,38,.04)' : isLowBudget ? 'rgba(217,119,6,.04)' : 'var(--surface-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', wordBreak: 'break-word' }}>{contract.product}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, wordBreak: 'break-word' }}>{contract.vendor}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          {tags.map(tag => (
            <span key={tag} style={{ fontSize: 9.5, fontWeight: 800, color: isExpiry ? '#DC2626' : '#D97706', background: isExpiry ? '#FEE2E2' : '#FEF3C7', padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap' }}>{tag}</span>
          ))}
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99 }} />
      </div>
      <div className="dmono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>
        ใช้ {contract.used.toLocaleString()} / {total.toLocaleString()}{contract.unit ? ` ${contract.unit}` : ''}
      </div>
    </div>
  )
}

function StaffLicenseStatRow({ icon, count, label, color, href }: { icon: string; count: number; label: string; color: string; href: string }) {
  const active = count > 0
  return (
    <Link href={href} className="attention-personnel-action" aria-label={`ดูรายชื่อ${label}`} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9,
      background: active ? `${color}0F` : 'var(--surface-2)',
      border: `1px solid ${active ? `${color}40` : 'var(--border)'}`,
      textDecoration: 'none', color: 'inherit',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? `${color}18` : 'var(--card)', color: active ? color : 'var(--muted)',
      }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: active ? color : 'var(--ink)', lineHeight: 1 }}>{count} คน</div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
      </div>
    </Link>
  )
}

function StaffLicenseStat({ expired, expiring, competencyOverdue, competencyDueSoon }: {
  expired: number; expiring: number; competencyOverdue: number; competencyDueSoon: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{`
        .attention-personnel-action { cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .attention-personnel-action:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15, 23, 42, .10); }
        .attention-personnel-action:focus-visible { outline: 3px solid rgba(30, 95, 173, .42); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .attention-personnel-action { transition: none; } .attention-personnel-action:hover { transform: none; } }
      `}</style>
      <StaffLicenseStatRow icon="alert" count={expired} label="ใบประกอบวิชาชีพหมดอายุแล้ว" color="#DC2626" href="/staff/personnel?filter=license-expired" />
      <StaffLicenseStatRow icon="clock" count={expiring} label="ใบประกอบวิชาชีพใกล้หมดอายุ" color="#D97706" href="/staff/personnel?filter=license-expiring" />
      <StaffLicenseStatRow icon="alert" count={competencyOverdue} label="สมรรถนะค้างประเมิน" color="#DC2626" href="/staff/personnel?filter=comp-overdue" />
      <StaffLicenseStatRow icon="clock" count={competencyDueSoon} label="สมรรถนะใกล้ครบกำหนดประเมิน" color="#D97706" href="/staff/personnel?filter=comp-due-soon" />
    </div>
  )
}

export function AttentionQueue({
  pendingDocs, totalPendingDocs, contracts, totalContracts,
  staffLicenseExpired, staffLicenseExpiring, staffCompetencyOverdue, staffCompetencyDueSoon,
  permissions,
}: AttentionQueueProps) {
  const canSeeDocs = (permissions['เอกสารคุณภาพ'] ?? 'none') !== 'none'
  const canSeeContracts = (permissions['สัญญา'] ?? 'none') !== 'none'
  const canSeeStaff = (permissions['บุคลากร'] ?? 'none') !== 'none'
  const staffLicenseTotal = staffLicenseExpired + staffLicenseExpiring + staffCompetencyOverdue + staffCompetencyDueSoon

  if (!canSeeDocs && !canSeeContracts && !canSeeStaff) return null

  const visibleCount = [canSeeDocs, canSeeContracts, canSeeStaff].filter(Boolean).length

  return (
    <div>
      <style>{`
        .attention-document-row { border-radius: 8px; cursor: pointer; transition: background-color .18s ease, box-shadow .18s ease; }
        .attention-document-row:hover { background: var(--primary-soft); box-shadow: inset 3px 0 0 var(--primary); }
        .attention-document-row:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 38%, transparent); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .attention-document-row { transition: none; } }
      `}</style>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>แจ้งเตือนและรายการติดตาม</div>
      </div>
      <div className="dash-attention-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleCount}, 1fr)`, gap: 12 }}>
        {canSeeContracts && (
          <GroupShell title="สัญญาใกล้หมด/งบคงเหลือต่ำ" icon="building" iconColor="#7C3AED" href="/staff/contracts" count={totalContracts}>
            {contracts.length > 0
              ? contracts.slice(0, 3).map(c => <ContractRow key={c.id} contract={c} />)
              : <Empty text="ไม่มีสัญญาที่ต้องดูแล" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeStaff && (
          <GroupShell title="บุคลากร" icon="users" iconColor="#8B5CF6" href="/staff/personnel/compliance" count={staffLicenseTotal}>
            {staffLicenseTotal > 0
              ? <StaffLicenseStat expired={staffLicenseExpired} expiring={staffLicenseExpiring} competencyOverdue={staffCompetencyOverdue} competencyDueSoon={staffCompetencyDueSoon} />
              : <Empty text="ไม่มีรายการบุคลากรที่ต้องติดตาม" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeDocs && (
          <GroupShell title="เอกสารรอเผยแพร่" icon="doc" iconColor="#0D9488" href="/staff/documents/pending" count={totalPendingDocs}>
            {pendingDocs.length > 0
              ? pendingDocs.slice(0, 3).map(doc => <DocumentRow key={doc.id} doc={doc} />)
              : <Empty text="ไม่มีเอกสารรอเผยแพร่" icon="shieldCheck" />}
          </GroupShell>
        )}
      </div>
    </div>
  )
}
