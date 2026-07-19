'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/context/LangContext'
import { ROUTE_LABELS } from '@/lib/navigation'

export function RouteBreadcrumbs() {
  const pathname = usePathname()
  const { lang } = useLang()
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 3) return null

  const visible = segments.slice(1)
  return (
    <nav aria-label={lang === 'th' ? 'เส้นทางหน้า' : 'Breadcrumb'} className="route-breadcrumbs">
      <style>{`
        .route-breadcrumbs{display:flex;align-items:center;gap:6px;margin:0 0 12px;color:var(--muted);font-size:11.5px;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
        .route-breadcrumbs a{color:var(--muted);text-decoration:none}.route-breadcrumbs a:hover{color:var(--primary);text-decoration:underline}.route-breadcrumb-current{color:var(--ink);font-weight:700}
      `}</style>
      {visible.map((segment, index) => {
        const routeIndex = index + 2
        const href = `/${segments.slice(0, routeIndex).join('/')}`
        const last = index === visible.length - 1
        const known = ROUTE_LABELS[segment]
        const label = known ? (lang === 'th' ? known.th : known.en) : (last ? (lang === 'th' ? 'รายละเอียด' : 'Details') : segment)
        return (
          <span key={`${segment}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {index > 0 && <span aria-hidden="true">/</span>}
            {last ? <span className="route-breadcrumb-current" aria-current="page">{label}</span> : <Link href={href}>{label}</Link>}
          </span>
        )
      })}
    </nav>
  )
}
