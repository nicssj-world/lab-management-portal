import { createClient } from '@/lib/supabase/server'
import { getProfiles, getAuditLog } from '@/lib/queries/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const ROLE_COLORS: Record<string, string> = {
  admin: 'red', staff: 'blue', editor: 'teal', viewer: 'gray',
}

const PERMISSIONS_MATRIX = [
  { resource: 'รายการตรวจ (อ่าน)',        admin: '✓', staff: '✓', editor: '✓', viewer: '✓' },
  { resource: 'รายการตรวจ (แก้ไข)',        admin: '✓', staff: '✓', editor: '—', viewer: '—' },
  { resource: 'เอกสารคุณภาพ',              admin: '✓', staff: '✓', editor: '—', viewer: '—' },
  { resource: 'ข่าวสาร',                   admin: '✓', staff: '✓', editor: '—', viewer: '—' },
  { resource: 'ความเสี่ยง / Rejection',    admin: '✓', staff: '✓', editor: '—', viewer: '—' },
  { resource: 'สัญญา',                     admin: '✓', staff: '✓', editor: '—', viewer: '—' },
  { resource: 'Workload (บันทึก)',         admin: '✓', staff: '—', editor: '✓', viewer: '—' },
  { resource: 'KPI (บันทึก)',              admin: '✓', staff: '✓', editor: '—', viewer: '—' },
  { resource: 'TAT (นำเข้า)',             admin: '✓', staff: '✓', editor: '—', viewer: '—' },
  { resource: 'จัดการผู้ใช้',             admin: '✓', staff: '—', editor: '—', viewer: '—' },
]

export default async function AdminPage() {
  const supabase = await createClient()
  const [profiles, auditLog] = await Promise.all([
    getProfiles(supabase),
    getAuditLog(supabase, 50),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="ระบบ"
        title="จัดการผู้ใช้และสิทธิ์"
        subtitle={`${profiles.length} ผู้ใช้งาน`}
        actions={<Button variant="primary" icon="plus">เชิญผู้ใช้</Button>}
      />

      {/* Users table */}
      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>ผู้ใช้ทั้งหมด</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['ชื่อ', 'บทบาท', 'แผนก', 'สถานะ', 'วันที่สร้าง', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--ink)' }}>{p.name}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge color={(ROLE_COLORS[p.role] ?? 'gray') as any} size="sm">{p.role}</Badge>
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12 }}>{p.dept ?? '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge color={p.status === 'active' ? 'green' : p.status === 'pending' ? 'amber' : 'gray'} size="sm">{p.status}</Badge>
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12 }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('th-TH') : '—'}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <button style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Permissions matrix */}
      <Card padding={20}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>สิทธิ์การใช้งาน</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>ทรัพยากร</th>
                {['admin', 'staff', 'editor', 'viewer'].map((role) => (
                  <th key={role} style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS_MATRIX.map((row) => (
                <tr key={row.resource} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 14px', color: 'var(--ink)', fontSize: 12.5 }}>{row.resource}</td>
                  {[row.admin, row.staff, row.editor, row.viewer].map((v, i) => (
                    <td key={i} style={{ padding: '9px 14px', textAlign: 'center', fontSize: 14, color: v === '✓' ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit log */}
      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Audit Log</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['การกระทำ', 'เป้าหมาย', 'รายละเอียด', 'วันที่'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLog.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูล Audit Log</td>
                </tr>
              ) : auditLog.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)' }}>{log.action}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{log.target ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>{log.detail ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString('th-TH') : '—'}
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
