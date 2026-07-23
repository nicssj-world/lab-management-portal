import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StaffSidebar } from '@/components/layout/StaffSidebar'
import { StaffTopbar } from '@/components/layout/StaffTopbar'
import { RouteBreadcrumbs } from '@/components/layout/RouteBreadcrumbs'
import { PermissionProvider } from '@/context/PermissionContext'
import { SidebarProvider } from '@/context/SidebarContext'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { normalizeRole } from '@/lib/roles'
import { ensureOwnProfile, isProfileNotProvisionedError } from '@/lib/auth/profile'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAssignedDeptIds } from '@/lib/queries/kpi'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  let profile
  try {
    profile = await ensureOwnProfile(user)
  } catch (profileError) {
    if (isProfileNotProvisionedError(profileError)) redirect('/login?error=account_not_provisioned')
    throw profileError
  }

  const LEGACY_ROLES: Record<string, string> = {
    admin: 'Admin', staff: 'Manager', editor: 'Medical Technologist', viewer: 'Assistant',
  }
  const role = profile.role ? (LEGACY_ROLES[profile.role] ?? profile.role) : undefined
  const permissions = role ? await getPermissionsWithEquipmentOverride(role, user.id) : {}
  // คณะทำงาน IT override: admin-equivalent edit on the งาน IT module regardless of role.
  if (role && normalizeRole(role) !== 'Admin') {
    const { data: itEditor } = await supabaseAdmin
      .from('it_editors').select('user_id').eq('user_id', user.id).maybeSingle()
    if (itEditor?.user_id) permissions['ระบบสารสนเทศ (IT)'] = 'edit'
    // Satisfaction override: edit on the whole แบบสำรวจความพึงพอใจ module regardless of role.
    const { data: surveyEditor } = await supabaseAdmin
      .from('satisfaction_editors').select('user_id').eq('user_id', user.id).maybeSingle()
    if (surveyEditor?.user_id) permissions['แบบสำรวจความพึงพอใจ'] = 'edit'
    // EQA / OUTLAB overrides: the module editor lists grant edit regardless of role,
    // matching externalQualityContext() so the sidebar matches what the routes allow.
    const { data: eqaEditor } = await supabaseAdmin
      .from('eqa_editors').select('user_id').eq('user_id', user.id).maybeSingle()
    if (eqaEditor?.user_id) permissions['EQA / PT'] = 'edit'
    const { data: outlabEditor } = await supabaseAdmin
      .from('outlab_editors').select('user_id').eq('user_id', user.id).maybeSingle()
    if (outlabEditor?.user_id) permissions['OUTLAB'] = 'edit'
  }
  if (['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(profile.doc_role ?? '')) {
    permissions['เอกสารคุณภาพ'] = 'edit'
  }
  if (profile.doc_role === 'Reviewer') {
    permissions['รายการตรวจ'] = 'edit'
  }
  // Users assigned as a per-dept KPI filler (kpi_dept_assignees) need at least
  // 'view' so the KPI module is reachable, even if their role has no KPI permission.
  if ((permissions['KPI'] ?? 'none') === 'none') {
    try {
      const kpiDeptIds = await getAssignedDeptIds(supabaseAdmin, user.id)
      if (kpiDeptIds.length > 0) permissions['KPI'] = 'view'
    } catch {
      // Keep existing role-based behaviour if kpi_dept_assignees is unavailable.
    }
  }

  return (
    <SidebarProvider>
      <style>{`
        .protected-shell { display: flex; min-height: 100vh; background: var(--bg); }
        .protected-main { flex: 1; padding: 28px; min-width: 0; overflow-x: auto; }
        .staff-sidebar-overlay { display: none !important; }
        .skip-to-content { position: fixed; top: 8px; left: 8px; z-index: 100; padding: 10px 14px; border-radius: 8px; background: var(--primary); color: #fff; font-weight: 700; text-decoration: none; transform: translateY(-160%); transition: transform .18s ease; }
        .skip-to-content:focus { transform: translateY(0); }

        @media (max-width: 767px) {
          .protected-shell { min-height: 100svh; width: 100%; }
          .protected-main { padding: 16px 12px 28px; width: 100%; }
          .staff-topbar { padding-inline: 12px !important; }
          .staff-sidebar-spacer { display: none !important; }
          .staff-sidebar {
            width: min(84vw, 304px) !important;
            height: 100svh !important;
            transform: translateX(-104%);
            transition: transform .22s ease, width .2s !important;
            box-shadow: 18px 0 50px rgba(15,23,42,.18);
          }
          .staff-sidebar.is-mobile-open { transform: translateX(0); }
          .staff-sidebar-overlay.is-mobile-open { display: block !important; }
        }
      `}</style>

      <div className="protected-shell">
        <a href="#main-content" className="skip-to-content">ข้ามไปเนื้อหาหลัก</a>
        <StaffSidebar
          userRole={role}
          userName={profile.name ?? undefined}
          userAvatar={profile.avatar_url ?? undefined}
          userDocRole={profile.doc_role ?? undefined}
          userPermissions={permissions}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <StaffTopbar />
          <PermissionProvider permissions={permissions}>
            <main id="main-content" tabIndex={-1} className="protected-main">
              <RouteBreadcrumbs />
              {children}
            </main>
          </PermissionProvider>
        </div>
      </div>
    </SidebarProvider>
  )
}
