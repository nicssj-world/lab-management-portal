import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { getRisks } from '@/lib/queries/risks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { RiskHeatmap } from '@/components/lab/RiskHeatmap'

export default async function RiskPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['ความเสี่ยง / Rejection'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ความเสี่ยง / Rejection'] === 'edit'

  const risks = await getRisks(supabase)

  const high = risks.filter((r) => r.level === 'high')
  const medium = risks.filter((r) => r.level === 'medium')
  const open = risks.filter((r) => r.status === 'open' || r.status === 'mitigating')

  const heatmapRisks = risks.map((r) => ({
    id: String(r.id),
    name: r.name,
    likelihood: r.likelihood ?? 1,
    impact: r.impact ?? 1,
    level: r.level ?? 'low',
    status: r.status ?? 'open',
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="คุณภาพ"
        title="ทะเบียนความเสี่ยง"
        subtitle="Risk Register · ISO 15189"
        actions={canEdit ? <Button variant="primary" icon="plus">เพิ่มความเสี่ยง</Button> : undefined}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Stat label="ความเสี่ยงระดับสูง" value={String(high.length)} color="red" icon="shield" />
        <Stat label="ระดับปานกลาง" value={String(medium.length)} color="amber" icon="shield" />
        <Stat label="รอดำเนินการ" value={String(open.length)} color="blue" icon="alert" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card padding={20}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Risk Heatmap</div>
          <RiskHeatmap risks={heatmapRisks} />
        </Card>

        <Card padding={20}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>ความเสี่ยงระดับสูง</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {high.slice(0, 6).map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(220,38,38,.06)', borderRadius: 8, borderLeft: '3px solid #DC2626' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                    Likelihood: {r.likelihood} · Impact: {r.impact} · Score: {(r.likelihood ?? 1) * (r.impact ?? 1)}
                  </div>
                </div>
                <Badge color="red" size="sm">{r.status}</Badge>
              </div>
            ))}
            {high.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>ไม่มีความเสี่ยงระดับสูง</div>
            )}
          </div>
        </Card>
      </div>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['ความเสี่ยง', 'Likelihood', 'Impact', 'Score', 'Level', 'ผู้รับผิดชอบ', 'สถานะ'].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => {
                const score = (r.likelihood ?? 1) * (r.impact ?? 1)
                const levelColor = r.level === 'high' ? 'red' : r.level === 'medium' ? 'amber' : 'green'
                const statusColor = r.status === 'open' ? 'red' : r.status === 'mitigating' ? 'amber' : r.status === 'monitoring' ? 'blue' : 'green'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 500, color: 'var(--ink)' }}>{r.name}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>{r.likelihood}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>{r.impact}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 700, color: score >= 15 ? '#DC2626' : score >= 8 ? '#D97706' : '#16A34A' }}>{score}</td>
                    <td style={{ padding: '11px 16px' }}><Badge color={levelColor as any} size="sm">{r.level}</Badge></td>
                    <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12 }}>{r.owner ?? '—'}</td>
                    <td style={{ padding: '11px 16px' }}><Badge color={statusColor as any} size="sm">{r.status}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
