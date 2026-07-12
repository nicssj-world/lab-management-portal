'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import {
  buildCatalogOpenUrl,
  buildCatalogSearchUrl,
  buildQuickSearchApiUrl,
  canQuickSearch,
} from '@/lib/catalog/quick-search'
import type { Test } from '@/lib/supabase/types'

type QuickResult = Pick<Test, 'id' | 'code' | 'th' | 'en' | 'tube' | 'tat' | 'tat_minutes' | 'department' | 'contact_name'>

export function PublicHeroSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<QuickResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<NodeJS.Timeout | null>(null)

  const trimmedQuery = query.trim()
  const canSearch = canQuickSearch(query)
  const catalogHref = useMemo(() => buildCatalogSearchUrl(query), [query])

  useEffect(() => {
    if (!canSearch) {
      setResults([])
      setLoading(false)
      setError('')
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        const res = await fetch(buildQuickSearchApiUrl(query), { signal: controller.signal })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถค้นหารายการตรวจได้')
        setResults((json.data ?? []) as QuickResult[])
        setOpen(true)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResults([])
        setError(err instanceof Error ? err.message : 'ไม่สามารถค้นหารายการตรวจได้')
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [canSearch, query])

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpen(false), 140)
  }

  function keepOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (canSearch) setOpen(true)
  }

  const showPanel = open && canSearch

  return (
    <div className={`public-hero-search-wrap ${showPanel ? 'is-open' : ''}`} onFocus={keepOpen} onBlur={scheduleClose}>
      <style>{`
        .public-hero-search-wrap {
          position: relative;
          width: min(100%, 520px);
        }
        .public-hero-search-wrap .public-hero-search {
          width: 100%;
        }
        .public-hero-suggestions {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 8px);
          z-index: 80;
          overflow: hidden;
          max-height: min(360px, calc(100vh - 160px));
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          border-radius: 14px;
          background: rgba(255,255,255,.98);
          border: 1px solid rgba(255,255,255,.72);
          box-shadow: 0 24px 60px rgba(11,22,38,.25), inset 0 1px 0 rgba(255,255,255,.8);
          color: #0F172A;
        }
        .public-hero-suggestion-item {
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 58px;
          padding: 11px 14px;
          text-decoration: none;
          color: inherit;
          border-bottom: 1px solid rgba(148,163,184,.18);
          transition: background .14s ease;
        }
        .public-hero-suggestion-item:hover,
        .public-hero-suggestion-item:focus-visible {
          background: rgba(30,95,173,.08);
          outline: none;
        }
        .public-hero-suggestion-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
          margin-top: 3px;
          color: #64748B;
          font-size: 11.5px;
          line-height: 1.35;
        }
        .public-hero-suggestion-department {
          display: block;
          margin-top: 2px;
          color: #64748B;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .public-hero-suggestion-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          color: var(--primary);
          font-size: 12.5px;
          font-weight: 800;
          text-decoration: none;
          background: rgba(30,95,173,.06);
        }
        .public-hero-suggestion-footer:hover,
        .public-hero-suggestion-footer:focus-visible {
          background: rgba(30,95,173,.1);
          outline: none;
        }
        @media (max-width: 520px) {
          .public-hero-search-wrap {
            width: 100%;
          }
          .public-hero-suggestions {
            max-height: min(320px, calc(100vh - 136px));
          }
          .public-hero-suggestion-item {
            min-height: 64px;
          }
        }
      `}</style>
      <form action="/catalog" method="get" className="public-hero-search" role="search">
        <label className="public-hero-search-field">
          <Icon name="search" size={17} />
          <input
            className="public-hero-search-input"
            name="search"
            type="search"
            aria-label="ค้นหารายการตรวจวิเคราะห์"
            aria-expanded={showPanel}
            aria-controls="public-hero-search-results"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={keepOpen}
            placeholder="ค้นหาชื่อ test, รหัส, specimen..."
          />
        </label>
        <button
          type="submit"
          className="public-hero-cta"
          style={{
            background: 'linear-gradient(135deg, var(--primary), var(--primary-2))', color: '#fff', border: 'none',
            padding: '12px 22px', borderRadius: 11, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.22), 0 10px 24px rgba(11,22,38,.18)',
          }}
        >
          ค้นหารายการตรวจ
        </button>
      </form>

      {showPanel && (
        <div id="public-hero-search-results" className="public-hero-suggestions" role="listbox" aria-label="รายการตรวจที่พบ">
          {loading && (
            <div style={{ padding: '14px', color: '#64748B', fontSize: 13, fontWeight: 600 }}>
              กำลังค้นหา...
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: '14px', color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div style={{ padding: '14px', color: '#64748B', fontSize: 13, fontWeight: 600 }}>
              ไม่พบรายการตรวจที่ตรงกับ "{trimmedQuery}"
            </div>
          )}

          {!loading && !error && results.map((test) => {
            const tatDisplay = test.tat_minutes ?? test.tat
            const departmentDisplay = test.department ?? test.contact_name
            return (
                <Link
                key={test.id}
                href={buildCatalogOpenUrl(test, query)}
                className="public-hero-suggestion-item"
                role="option"
              >
                <span style={{
                  width: 34, height: 34, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--primary-soft)', color: 'var(--primary)', flexShrink: 0,
                }}>
                  <Icon name="flask" size={17} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, lineHeight: 1.35, color: '#0F172A' }}>
                    {test.th}
                  </span>
                  <span className="public-hero-suggestion-meta">
                    <span>รหัส E-phis {test.code}</span>
                    {test.tube && <span>{test.tube}</span>}
                    {tatDisplay && <span>TAT {tatDisplay}</span>}
                  </span>
                  {departmentDisplay && (
                    <span className="public-hero-suggestion-department">
                      {departmentDisplay}
                    </span>
                  )}
                </span>
                <Icon name="arrowRight" size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              </Link>
            )
          })}

          <Link href={catalogHref} className="public-hero-suggestion-footer">
            <span>ดูผลลัพธ์ทั้งหมด</span>
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
