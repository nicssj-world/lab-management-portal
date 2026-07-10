import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { Empty } from '@/components/dashboard/Empty'
import { monthsLeftUntil, isContractExpiring, daysOverdue, type RiskRow } from '@/lib/dashboard/attention-queue'
import type { PendingApprovalDoc } from '@/lib/documents/pending'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import type { Permissions } from '@/lib/permissions'

interface RejectionAlert {
  rate: number
  changeText: string | null
}

interface AttentionQueueProps {
  pendingDocs: PendingApprovalDoc[]
  totalPendingDocs: number
  contracts: ContractWithUsage[]
  totalContracts: number
  urgentRisks: RiskRow[]
  totalUrgentRisks: number
  rejectionAlert: RejectionAlert | null
  permissions: Permissions
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
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{doc.document_code}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
      <div style={{ fontSize: 10.5, color: '#B45309', fontWeight: 700, marginTop: 3 }}>รอ {days} วัน</div>
    </div>
  )
}

function ContractRow({ contract }: { contract: ContractWithUsage }) {
  const total = contract.total ?? 0
  const remaining = total > 0 ? 100 - (contract.used / total) * 100 : 100
  const months = monthsLeftUntil(contract.end_date)
  const isExpiry = isContractExpiring(total, months)
  const tag = isExpiry ? (months <= 0 ? 'หมดอายุแล้ว' : `เหลือ ${months} เดือน`) : `งบเหลือ ${remaining.toFixed(0)}%`
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{contract.vendor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contract.product}</div>
      <div style={{ fontSize: 10.5, color: isExpiry ? '#DC2626' : '#B45309', fontWeight: 700, marginTop: 3 }}>{tag}</div>
    </div>
  )
}

function RiskRowItem({ risk }: { risk: RiskRow }) {
  const todayISO = new Date().toISOString().slice(0, 10)
  const days = Math.max(
    daysOverdue(risk.due_date, todayISO) ?? 0,
    daysOverdue(risk.follow_up_date, todayISO) ?? 0,
  )
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{risk.risk_no ?? `#${risk.id}`}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.name}</div>
      <div style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 700, marginTop: 3 }}>
        {risk.severity_level ? `ระดับ ${risk.severity_level.toUpperCase()}` : ''}
        {days > 0 ? ` · เกินกำหนด ${days} วัน` : ''}
      </div>
    </div>
  )
}

export function AttentionQueue({
  pendingDocs, totalPendingDocs, contracts, totalContracts,
  urgentRisks, totalUrgentRisks, rejectionAlert, permissions,
}: AttentionQueueProps) {
  const canSeeDocs = (permissions['เอกสารคุณภาพ'] ?? 'none') !== 'none'
  const canSeeContracts = (permissions['สัญญา'] ?? 'none') !== 'none'
  const canSeeRisk = (permissions['ความเสี่ยง / Rejection'] ?? 'none') !== 'none'

  if (!canSeeDocs && !canSeeContracts && !canSeeRisk) return null

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>ต้องดำเนินการวันนี้</div>
      </div>
      <div className="dash-attention-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {canSeeDocs && (
          <GroupShell title="เอกสารรออนุมัติ" icon="doc" iconColor="#0D9488" href="/staff/documents/pending" count={totalPendingDocs}>
            {pendingDocs.length > 0
              ? pendingDocs.slice(0, 3).map(doc => <DocumentRow key={doc.id} doc={doc} />)
              : <Empty text="ไม่มีเอกสารรออนุมัติ" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeContracts && (
          <GroupShell title="สัญญา" icon="building" iconColor="#7C3AED" href="/staff/contracts" count={totalContracts}>
            {contracts.length > 0
              ? contracts.slice(0, 3).map(c => <ContractRow key={c.id} contract={c} />)
              : <Empty text="ไม่มีสัญญาที่ต้องดูแล" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeRisk && (
          <GroupShell title="ความเสี่ยง" icon="shield" iconColor="#DC2626" href="/staff/risk" count={totalUrgentRisks}>
            {urgentRisks.length > 0
              ? urgentRisks.slice(0, 3).map(r => <RiskRowItem key={r.id} risk={r} />)
              : <Empty text="ไม่มีความเสี่ยงที่ต้องดำเนินการ" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeRisk && rejectionAlert && (
          <GroupShell title="Rejection" icon="alert" iconColor="#F59E0B" href="/staff/rejection" count={1}>
            <div style={{ padding: '8px 0' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>{rejectionAlert.rate.toFixed(2)}%</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>เป้าหมาย: &lt;3%{rejectionAlert.changeText ? ` · ${rejectionAlert.changeText}` : ''}</div>
            </div>
          </GroupShell>
        )}
      </div>
    </div>
  )
}
