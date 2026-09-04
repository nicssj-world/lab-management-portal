import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { getPermissionsWithItOverride } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const IT_RESOURCE = 'ระบบสารสนเทศ (IT)'
const VERIFICATION_RESOURCE = 'ทวนสอบการส่งผ่านข้อมูล HIS & LIS'
const IT_BLUE = '#0369A1'

const IT_CARDS = [
  {
    href: '/staff/it/access',
    resource: IT_RESOURCE,
    icon: 'lock',
    title: 'สิทธิ์เข้าถึง HIS & LIS',
    en: 'Access Rights',
    description: 'จัดการทะเบียนสิทธิ์และทบทวนการเข้าถึงระบบสารสนเทศ',
  },
  {
    href: '/staff/it/verification',
    resource: VERIFICATION_RESOURCE,
    icon: 'shieldCheck',
    title: 'ทวนสอบการส่งผ่านข้อมูล',
    en: 'Data Transfer Verification',
    description: 'ตรวจสอบการส่งผ่านข้อมูลระหว่าง LIS และ HIS ตามรอบงาน',
  },
  {
    href: '/staff/it/downtime',
    resource: IT_RESOURCE,
    icon: 'alert',
    title: 'บันทึกระบบล่ม',
    en: 'Downtime Log',
    description: 'บันทึกเหตุขัดข้อง แผนสำรอง และการแก้ไขระบบ',
  },
  {
    href: '/staff/it/backup',
    resource: IT_RESOURCE,
    icon: 'download',
    title: 'การสำรองข้อมูล',
    en: 'Backup Log',
    description: 'ติดตามการสำรองข้อมูลและการทดสอบกู้คืน',
  },
] as const

export default async function ItHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actor } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const permissions = actor?.role ? await getPermissionsWithItOverride(actor.role, user.id) : {}
  const visibleCards = IT_CARDS.filter(card => (permissions[card.resource] ?? 'none') !== 'none')

  if (visibleCards.length === 0) redirect('/staff/dashboard')

  return (
    <div className="it-hub-page">
      <style>{`
        .it-hub-page { max-width: 1120px; margin: 0 auto; --it-card-color: ${IT_BLUE}; --it-card-soft: ${IT_BLUE}16; }
        [data-theme="dark"] .it-hub-page { --it-card-color: #7DD3FC; --it-card-soft: rgba(14, 116, 144, .22); }
        .it-hub-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .it-hub-card {
          display: flex; align-items: flex-start; gap: 16px; min-height: 164px;
          padding: 20px; border: 1px solid var(--border); border-radius: 14px;
          background: var(--card); color: var(--ink); text-decoration: none;
          box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
          transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease;
        }
        .it-hub-card:hover { border-color: var(--it-card-color); background: var(--surface-2); box-shadow: 0 10px 24px rgba(15, 23, 42, .09); }
        .it-hub-card:focus-visible { outline: 3px solid var(--primary-2); outline-offset: 3px; }
        .it-hub-card-icon {
          display: inline-flex; align-items: center; justify-content: center; flex: 0 0 44px;
          width: 44px; height: 44px; border-radius: 12px; background: var(--it-card-soft); color: var(--it-card-color);
        }
        .it-hub-card-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; }
        .it-hub-card-title { font-size: 16px; font-weight: 800; line-height: 1.35; }
        .it-hub-card-en { margin-top: 3px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .02em; }
        .it-hub-card-description { max-width: 48ch; margin: 10px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
        .it-hub-card-arrow { flex: 0 0 auto; margin-top: 3px; color: var(--it-card-color); }
        @media (max-width: 767px) {
          .it-hub-grid { grid-template-columns: 1fr; gap: 12px; }
          .it-hub-card { min-height: 144px; padding: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .it-hub-card { transition: none; }
        }
      `}</style>
      <PageHeader title="ระบบสารสนเทศ (IT)" subtitle="ศูนย์รวมทางลัดสำหรับงาน HIS & LIS" />
      <nav aria-label="งานระบบสารสนเทศ HIS และ LIS" className="it-hub-grid">
        {visibleCards.map(card => (
          <Link key={card.href} href={card.href} className="it-hub-card" aria-label={`${card.title} (${card.en})`}>
            <span className="it-hub-card-icon" aria-hidden="true">
              <Icon name={card.icon} size={21} stroke={1.8} />
            </span>
            <span className="it-hub-card-copy">
              <span className="it-hub-card-title">{card.title}</span>
              <span className="it-hub-card-en">{card.en}</span>
              <span className="it-hub-card-description">{card.description}</span>
            </span>
            <span className="it-hub-card-arrow" aria-hidden="true">
              <Icon name="arrowRight" size={18} stroke={1.8} />
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
