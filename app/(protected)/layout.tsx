import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StaffSidebar } from '@/components/layout/StaffSidebar'
import { StaffTopbar } from '@/components/layout/StaffTopbar'
import { PermissionProvider } from '@/context/PermissionContext'
import { SidebarProvider } from '@/context/SidebarContext'
import { getRolePermissions } from '@/lib/permissions'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, avatar_url, doc_role')
    .eq('id', session.user.id)
    .single()

  const LEGACY_ROLES: Record<string, string> = {
    admin: 'Admin', staff: 'Manager', editor: 'Medical Technologist', viewer: 'Assistant',
  }
  const role = profile?.role ? (LEGACY_ROLES[profile.role] ?? profile.role) : undefined
  const permissions = role ? await getRolePermissions(role) : {}
  if (['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(profile?.doc_role ?? '')) {
    permissions['เอกสารคุณภาพ'] = 'edit'
  }
  if (profile?.doc_role === 'Reviewer') {
    permissions['รายการตรวจ'] = 'edit'
  }

  return (
    <SidebarProvider>
      <style>{`
        .protected-shell { display: flex; min-height: 100vh; background: var(--bg); }
        .protected-main { flex: 1; padding: 28px; min-width: 0; overflow-x: auto; }
        .staff-sidebar-overlay { display: none !important; }

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
        <StaffSidebar
          userRole={role}
          userName={profile?.name ?? undefined}
          userAvatar={profile?.avatar_url ?? undefined}
          userDocRole={profile?.doc_role ?? undefined}
          userPermissions={permissions}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <StaffTopbar />
          <PermissionProvider permissions={permissions}>
            <main className="protected-main">
              {children}
            </main>
          </PermissionProvider>
        </div>
      </div>
    </SidebarProvider>
  )
}
