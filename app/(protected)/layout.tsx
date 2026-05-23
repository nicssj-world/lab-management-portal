import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StaffSidebar } from '@/components/layout/StaffSidebar'
import { StaffTopbar } from '@/components/layout/StaffTopbar'
import { Icon } from '@/components/ui/Icon'
import { MobileBypassInit, MobileBypassButton } from '@/components/layout/MobileBypass'
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

  return (
    <SidebarProvider>
      <MobileBypassInit />
      <style>{`
        .protected-desktop-shell { display: flex; }
        .protected-mobile-block { display: none; min-height: 100vh; min-height: 100svh; }

        @media (max-width: 767px), (max-height: 500px) and (hover: none) and (pointer: coarse) {
          .protected-desktop-shell { display: none !important; }
          .protected-mobile-block { display: flex !important; }
        }

        [data-mobile-bypass] .protected-desktop-shell { display: flex !important; }
        [data-mobile-bypass] .protected-mobile-block { display: none !important; }
      `}</style>

      <div
        className="protected-mobile-block"
        style={{
          background: 'var(--bg)',
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 18px 50px rgba(15,23,42,.12)',
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Icon name="building" size={24} />
          </div>
          <h1 style={{ margin: 0, color: 'var(--ink)', fontSize: 24, lineHeight: 1.25 }}>
            แนะนำใช้งานบน Tablet หรือ Desktop
          </h1>
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 15, lineHeight: 1.75 }}>
            ระบบเจ้าหน้าที่มีตาราง ฟอร์ม และเครื่องมือจัดการข้อมูลหลายส่วน จึงปิดการแสดงผลบนหน้าจอโทรศัพท์เพื่อป้องกันข้อมูลซ้อนทับและใช้งานผิดพลาด
          </p>
          <div
            style={{
              marginTop: 20,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            หากต้องการดูข้อมูลจากมือถือ สามารถกลับไปยังหน้า public เช่น รายการตรวจวิเคราะห์หรือคู่มือห้องปฏิบัติการได้
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--primary)',
                color: '#fff',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Icon name="home" size={15} />
              หน้าแรก
            </a>
            <a
              href="/catalog"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Icon name="search" size={15} />
              รายการตรวจ
            </a>
            <MobileBypassButton />
          </div>
        </div>
      </div>

      <div className="protected-desktop-shell" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
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
            <main style={{ flex: 1, padding: 28 }}>
              {children}
            </main>
          </PermissionProvider>
        </div>
      </div>
    </SidebarProvider>
  )
}
