'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import type { ViewNavigationItem } from '@/lib/navigation'

interface ViewTabsProps<T extends string> {
  items: readonly ViewNavigationItem<T>[]
  value: T
  param?: string
  label: string
  compact?: boolean
}

export function ViewTabs<T extends string>({ items, value, param = 'view', label, compact = false }: ViewTabsProps<T>) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function hrefFor(nextValue: T) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(param, nextValue)
    return `${pathname}?${params.toString()}`
  }

  return (
    <nav aria-label={label} className={`view-tabs${compact ? ' view-tabs-compact' : ''}`}>
      <style>{`
        .view-tabs{display:flex;gap:4px;width:fit-content;max-width:100%;padding:4px;overflow-x:auto;border-radius:12px;background:var(--surface-2);scrollbar-width:thin}
        .view-tab{display:inline-flex;min-height:44px;flex:0 0 auto;align-items:center;gap:7px;padding:8px 16px;border-radius:9px;color:var(--muted);font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;transition:color .18s ease,background .18s ease,box-shadow .18s ease}
        .view-tab:hover{color:var(--ink);background:color-mix(in srgb,var(--card) 72%,transparent)}
        .view-tab[aria-current="page"]{color:var(--primary);background:var(--card);font-weight:700;box-shadow:inset 0 -2px 0 var(--primary),0 1px 4px rgba(15,23,42,.08)}
        .view-tab:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:-1px}
        .view-tabs-compact .view-tab{min-height:44px;padding:7px 12px;font-size:12.5px}
        @media(prefers-reduced-motion:reduce){.view-tab{transition:none}}
      `}</style>
      {items.map((item) => (
        <Link key={item.id} href={hrefFor(item.id)} scroll={false} aria-current={value === item.id ? 'page' : undefined} className="view-tab">
          {item.icon && <span aria-hidden="true"><Icon name={item.icon} size={15} /></span>}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
