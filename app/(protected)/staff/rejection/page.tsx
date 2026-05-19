import { createClient } from '@/lib/supabase/server'
import { getRejectionLogs, getRejectionStats } from '@/lib/queries/rejection'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Stat } from '@/components/ui/Stat'

export default async function RejectionPage() {
  const supabase = await createClient()
  const [logs, stats] = await Promise.all([
    getRejectionLogs(supabase, { limit: 100 }),
    getRejectionStats(supabase),
  ])

  const topReasons = Object.entries(stats.byReason).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxCount = topReasons[0]?.[1] ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="คุณภาพ" title="บันทึกการปฏิเสธตัวอย่าง" subtitle="Specimen Rejection Log" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Stat label="รวมการปฏิเสธ" value={String(stats.total)} color="blue" icon="alert" />
        <Stat label="ระดับ High" value={String(stats.bySeverity['high'] ?? 0)} color="red" icon="alert" />
        <Stat label="สาเหตุที่พบมากสุด" value={topReasons[0]?.[0] ?? '—'} color="amber" icon="alert" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Rejection by reason bar chart */}
        <Card padding={20}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
            แยกตามสาเหตุ
          </div>
          {topReasons.map(([reason, count]) => (
            <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 160, fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {reason}
              </div>
              <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: 'var(--primary)', borderRadius: 4 }} />
              </div>
              <div style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{count}</div>
            </div>
          ))}
        </Card>

        {/* Severity breakdown */}
        <Card padding={20}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>
            แยกตามระดับความรุนแรง
          </div>
          {(['high', 'medium', 'low'] as const).map((sev) => {
            const count = stats.bySeverity[sev] ?? 0
            const color = sev === 'high' ? '#DC2626' : sev === 'medium' ? '#D97706' : '#16A34A'
            return (
              <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500, textTransform: 'capitalize' }}>{sev}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
              </div>
            )
          })}
        </Card>
      </div>

      {/* Log table */}
      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['เลขที่อ้างอิง', 'รหัสตรวจ', 'สาเหตุ', 'แผนก', 'บันทึกโดย', 'ระดับ', 'วันที่'].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{r.ref_no}</td>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12 }}>{r.test_code ?? '—'}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--ink)' }}>{r.reason ?? '—'}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--muted)' }}>{r.dept ?? '—'}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12 }}>{r.logged_by ?? '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge color={r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'amber' : 'green'} size="sm">
                      {r.severity ?? 'low'}
                    </Badge>
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12 }}>
                    {r.logged_at ? new Date(r.logged_at).toLocaleDateString('th-TH') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
