import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StaffSidebar } from '@/components/layout/StaffSidebar'
import { StaffTopbar } from '@/components/layout/StaffTopbar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, avatar_url')
    .eq('id', session.user.id)
    .single()

  const LEGACY_ROLES: Record<string, string> = {
    admin: 'Admin', staff: 'Manager', editor: 'Medical Technologist', viewer: 'Assistant',
  }
  const role = profile?.role ? (LEGACY_ROLES[profile.role] ?? profile.role) : undefined

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <StaffSidebar
        userRole={role}
        userName={profile?.name ?? undefined}
        userAvatar={profile?.avatar_url ?? undefined}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <StaffTopbar />
        <main style={{ flex: 1, padding: 28 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
