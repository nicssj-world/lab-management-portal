import { createClient } from '@/lib/supabase/server'
import { getRisks } from '@/lib/queries/risks'
import { getContracts } from '@/lib/queries/contracts'
import { getRejectionLogs } from '@/lib/queries/rejection'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RiskHeatmap } from '@/components/lab/RiskHeatmap'
import { ContractBattery } from '@/components/lab/ContractBattery'
import Link from "next/link"

export default async function StaffDashboardPage() {
  const supabase = await createClient()
  const [risks, contracts, recentRejections] = await Promise.all([
    getRisks(supabase),
    getContracts(supabase),
    getRejectionLogs(supabase, { limit: 50 }),
  ])

  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  const rejByReason: Record<string, number> = {}
  for (const r of recentRejections) {
    const key = r.reason ?? 'Unknown'
    rejByReason[key] = (rejByReason[key] ?? 0) + 1
  }
  const topReasons = Object.entries(rejByReason).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const totalRej = recentRejections.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow={`วันนี้ ${today}`}
        title="แดชบอร์ดภาพรวมงานห้องปฏิบัติการ"
        subtitle="Lab Operations Dashboard"
      />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Stat label="TAT compliance" value="—" color="green" icon="clock" />
        <Stat label="Rejection rate" value={totalRej > 0 ? `${totalRej}` : '0'} color="amber" icon="alert" />
        <Stat label="ความเสี่ยงระดับสูง" value={String(risks.filter((r) => r.level === 'high').length)} color="red" icon="shield" />
        <Stat label="สัญญาใกล้หมด" value={String(contracts.filter((c) => {
          if (!c.end_date) return false
          const days = (new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          return days < 30 && days > 0
        }).length)} color="amber" icon="building" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Rejection by reason */}
        <Card padding={20}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>การปฏิเสธตัวอย่าง — แยกตามสาเหตุ</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>รวมทั้งหมด {totalRej} ครั้ง</div>
          </div>
          {topReasons.length > 0 ? (
            topReasons.map(([reason, count]) => {
              const pct = totalRej > 0 ? (count / totalRej) * 100 : 0
              return (
                <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 130, fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {reason}
                  </div>
                  <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 40, textAlign: 'right', fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{count}</div>
                </div>
              )
            })
          ) : (
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>ไม่มีข้อมูล</div>
          )}
        </Card>

        {/* Risk heatmap */}
        <Card padding={20}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>ทะเบียนความเสี่ยง — Heatmap</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Likelihood × Impact (1–5)</div>
          </div>
          <RiskHeatmap risks={risks.map((r) => ({
            id: String(r.id),
            name: r.name,
            likelihood: r.likelihood ?? 1,
            impact: r.impact ?? 1,
            level: r.level ?? 'low',
            status: r.status ?? 'open',
          }))} />
        </Card>
      </div>

      {/* Contracts */}
      <Card padding={20}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>การบริหารสัญญา</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>สัญญาวัสดุและบริการ</div>
          </div>
          <Link href="/staff/contracts">
          <Button variant="secondary" size="sm">
            ดูทั้งหมด →</Button></Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {contracts.slice(0, 6).map((c) => {
            const isExpiring = c.end_date && (new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 30
            return (
              <div
                key={c.id}
                style={{
                  padding: 16, background: 'var(--surface-2)', borderRadius: 10,
                  borderLeft: `3px solid ${isExpiring ? '#DC2626' : '#16A34A'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{c.vendor}</div>
                  {isExpiring && <Badge color="red" size="sm">ใกล้หมด</Badge>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{c.product}</div>
                <ContractBattery
                  total={c.total ?? 0}
                  used={c.used}
                  label={`${((c.used / (c.total ?? 1)) * 100).toFixed(1)}% ใช้แล้ว`}
                />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
