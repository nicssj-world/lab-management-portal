import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getAuditLog, type AuditLogWithUser } from '@/lib/queries/admin'
import { getRolePermissions } from '@/lib/permissions'
import { normalizeRole } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { AdminUserClient } from './AdminUserClient'
import { PermissionsMatrix } from './PermissionsMatrix'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actor } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(actor?.role)
  const permissions = role ? await getRolePermissions(role) : {}
  const isAdmin = (permissions['User Management'] ?? 'none') === 'edit'
  const isDocumentProfileManager = role === 'Manager'
  if (!isAdmin && !isDocumentProfileManager) redirect('/staff/dashboard')

  // Count with the admin client so RLS does not reduce the total to the current profile.
  // .is('deleted_at', null) only works after user-management-migration.sql has been run.
  const countResult = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
  const count = countResult.error
    ? (await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })).count
    : countResult.count

  const { data: roleRows } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .is('deleted_at', null)
  const roleCounts: Record<string, number> = {}
  for (const r of roleRows ?? []) {
    roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1
  }

  const auditLog = await getAuditLog(supabaseAdmin, 30).catch(() => [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="ระบบ"
        title="User Management"
        subtitle={`${count ?? 0} ผู้ใช้งานในระบบ`}
        marginBottom={8}
      />

      {/* Role count chips */}
      {(() => {
        const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
          'Admin':                     { bg: 'rgba(220,38,38,.1)',    color: '#DC2626' },
          'Manager':                   { bg: 'rgba(30,95,173,.1)',    color: '#1E5FAD' },
          'Document Controller':       { bg: 'rgba(147,51,234,.1)',   color: '#7C3AED' },
          'Medical Technologist':      { bg: 'rgba(13,148,136,.1)',   color: '#0D9488' },
          'Medical Science Technician':{ bg: 'rgba(217,119,6,.1)',    color: '#D97706' },
          'Assistant':                 { bg: 'rgba(100,116,139,.1)',  color: '#475569' },
        }
        const entries = Object.entries(ROLE_STYLES).filter(([role]) => (roleCounts[role] ?? 0) > 0)
        if (!entries.length) return null
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {entries.map(([role, s]) => (
              <span key={role} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: s.bg, color: s.color,
              }}>
                {role}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: s.color, color: '#fff', fontSize: 10.5, fontWeight: 700,
                }}>
                  {roleCounts[role]}
                </span>
              </span>
            ))}
          </div>
        )
      })()}

      {/* User table — full client-side CRUD */}
      <AdminUserClient canAdminUsers={isAdmin} canManageDocumentProfiles={isAdmin || isDocumentProfileManager} />

      {/* Permissions matrix — editable by Admin */}
      {isAdmin && <PermissionsMatrix isAdmin={isAdmin} />}

      {/* Audit log */}
      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Audit Log</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>30 รายการล่าสุด</div>
        </div>
        <StickyScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['การกระทำ', 'ผู้ดำเนินการ', 'เป้าหมาย', 'รายละเอียด', 'วันที่'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLog.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูล Audit Log</td>
                </tr>
              ) : auditLog.map((log: AuditLogWithUser) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    <code style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{log.action}</code>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {log.user_name ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--muted)' }}>{log.target ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12, maxWidth: 280 }}>{log.detail ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString('th-TH') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StickyScroll>
      </Card>
    </div>
  )
}
