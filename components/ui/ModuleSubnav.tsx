'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { isPathActive, type ModuleNavigationItem } from '@/lib/navigation'

interface ModuleSubnavProps {
  items: readonly ModuleNavigationItem[]
  label: string
  preserveQuery?: boolean
}

export function ModuleSubnav({ items, label, preserveQuery = true }: ModuleSubnavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { lang } = useLang()
  const query = preserveQuery ? searchParams.toString() : ''

  return (
    <div className="module-subnav-shell">
      <style>{`
        .module-subnav-shell{position:relative;max-width:100%;overflow:hidden;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}
        .module-subnav{display:flex;gap:5px;max-width:100%;padding:5px;overflow-x:auto;scrollbar-width:thin;overscroll-behavior-inline:contain}
        .module-subnav-link{display:inline-flex;min-height:44px;flex:0 0 auto;align-items:center;gap:7px;padding:9px 14px;border-radius:10px;color:var(--muted);font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;transition:color .18s ease,background .18s ease,box-shadow .18s ease}
        .module-subnav-link:hover{color:var(--ink);background:color-mix(in srgb,var(--card) 78%,var(--primary-soft))}
        .module-subnav-link[aria-current="page"]{color:var(--primary);background:var(--card);box-shadow:inset 0 -2px 0 var(--primary),0 2px 7px rgba(15,23,42,.08)}
        .module-subnav-link:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:-1px}
        @media(max-width:767px){.module-subnav-shell::after{content:"";position:absolute;inset:0 0 0 auto;width:24px;pointer-events:none;background:linear-gradient(90deg,transparent,var(--surface-2))}.module-subnav-link{padding-inline:12px}}
        @media(prefers-reduced-motion:reduce){.module-subnav-link{transition:none}}
      `}</style>
      <nav aria-label={label} className="module-subnav">
        {items.map((item) => {
          const active = isPathActive(pathname, item)
          const href = query ? `${item.href}?${query}` : item.href
          return (
            <Link key={item.id} href={href} scroll={false} aria-current={active ? 'page' : undefined} className="module-subnav-link">
              {item.icon && <span aria-hidden="true"><Icon name={item.icon} size={15} /></span>}
              <span>{lang === 'th' ? item.labelTh : (item.labelEn ?? item.labelTh)}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
