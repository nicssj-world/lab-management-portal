'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { TestFilters } from '@/components/tests/TestFilters'
import { TestTable } from '@/components/tests/TestTable'
import { CatalogDetailModal } from '@/components/tests/CatalogDetailModal'
import { buildCatalogFilterUrl } from '@/lib/catalog/filter-url'
import { createClient } from '@/lib/supabase/client'
import { getCategories } from '@/lib/queries/categories'
import type { Test, Category } from '@/lib/supabase/types'

const PAGE_SIZE = 20

function parseOpenId(value: string | null) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function CatalogContent() {
  const searchParams = useSearchParams()
  const [tests, setTests] = useState<Test[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('cat') ?? '')
  const [tube, setTube] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [allTotal, setAllTotal] = useState(0)
  const [sortBy, setSortBy] = useState('display_name_alpha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [error, setError] = useState('')
  const [selectedTestId, setSelectedTestId] = useState<number | null>(() => parseOpenId(searchParams.get('open')))
  const timer = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const selectedTest = tests.find((test) => test.id === selectedTestId) ?? null

  useEffect(() => {
    getCategories(supabase, true).then(setCategories)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const doLoad = useCallback(async (s: string, cat: string, tb: string, pg: number, sb: string, sd: 'asc' | 'desc') => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE), sortBy: sb, sortDir: sd })
      if (s) params.set('search', s)
      if (cat) params.set('category', cat)
      if (tb) params.set('tube', tb)
      const res = await fetch(`/api/tests?${params}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Failed to load tests')
      setTests(j.data ?? [])
      const cnt = j.count ?? 0
      setTotal(cnt)
      if (pg === 0 && !s && !cat && !tb) setAllTotal(cnt)
    } catch (err) {
      setTests([])
      setTotal(0)
      setError(err instanceof Error ? err.message : 'Failed to load tests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const nextUrl = buildCatalogFilterUrl({ search, categoryId, tube, openId: selectedTestId })
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [search, categoryId, tube, selectedTestId])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => doLoad(search, categoryId, tube, 0, sortBy, sortDir), search ? 350 : 0)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [search, categoryId, tube, sortBy, sortDir, doLoad])

  function handlePageChange(p: number) {
    setPage(p)
    doLoad(search, categoryId, tube, p, sortBy, sortDir)
  }

  function handleSort(col: string, dir: 'asc' | 'desc') {
    setSortBy(col)
    setSortDir(dir)
    setPage(0)
  }

  return (
    <main className="catalog-page" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`
        .catalog-page {
          background:
            radial-gradient(circle at 10% 0%, var(--primary-soft) 0, transparent 32%),
            linear-gradient(180deg, var(--bg), var(--surface-2)) !important;
        }
        .catalog-page-inner {
          position: relative;
        }
        .catalog-page-inner::before {
          content: "";
          position: absolute;
          inset: 12px 18px auto;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--public-hairline), transparent);
          pointer-events: none;
        }
        .catalog-page input,
        .catalog-page select {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.72), var(--public-shadow-sm);
        }
        .catalog-page input:focus,
        .catalog-page select:focus {
          box-shadow: 0 0 0 4px var(--primary-soft), inset 0 1px 0 rgba(255,255,255,.8), var(--public-shadow-sm);
        }
        .catalog-page .test-table-desktop-wrap > div {
          border-color: var(--public-hairline) !important;
          box-shadow: var(--public-shadow-md);
        }
        .catalog-page .test-table-mobile-list article {
          border-color: var(--public-hairline) !important;
          box-shadow: var(--public-shadow-sm);
        }
      `}</style>
      <div className="catalog-page-inner" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PageHeader
          eyebrow="ค้นหา"
          title="รายการตรวจวิเคราะห์"
          subtitle={`ทั้งหมด ${allTotal} รายการ`}
        />

        <TestFilters
          search={search}
          onSearch={(v) => { setSearch(v); setPage(0) }}
          categoryId={categoryId}
          onCategoryChange={(v) => { setCategoryId(v); setPage(0) }}
          tube={tube}
          onTubeChange={(v) => { setTube(v); setPage(0) }}
          categories={categories}
          total={allTotal || total}
          filtered={total}
        />

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(220,38,38,.06)', fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <TestTable
          tests={tests}
          categories={categories}
          loading={loading}
          canEdit={false}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          onPageChange={handlePageChange}
          getHref={(t) => `/catalog/${t.id}`}
          onOpen={(test) => setSelectedTestId(test.id)}
          nameSortKey="display_name_alpha"
          headerFontSize={11.5}
          showUpdatedAt
        />
        <CatalogDetailModal
          testId={selectedTestId}
          fallbackTest={selectedTest}
          categories={categories}
          onClose={() => setSelectedTestId(null)}
        />
      </div>
    </main>
  )
}

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogContent />
    </Suspense>
  )
}
