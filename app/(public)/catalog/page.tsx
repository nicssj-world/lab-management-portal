'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { TestFilters } from '@/components/tests/TestFilters'
import { TestTable } from '@/components/tests/TestTable'
import { createClient } from '@/lib/supabase/client'
import { getCategories } from '@/lib/queries/categories'
import type { Test, Category } from '@/lib/supabase/types'

const PAGE_SIZE = 20

export default function CatalogPage() {
  const searchParams = useSearchParams()
  const [tests, setTests] = useState<Test[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(searchParams.get('cat') ?? '')
  const [tube, setTube] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [allTotal, setAllTotal] = useState(0)
  const [sortBy, setSortBy] = useState('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const timer = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    getCategories(supabase, true).then(setCategories)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const doLoad = useCallback(async (s: string, cat: string, tb: string, pg: number, sb: string, sd: 'asc' | 'desc') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE), active: 'true', sortBy: sb, sortDir: sd })
      if (s) params.set('search', s)
      if (cat) params.set('category', cat)
      if (tb) params.set('tube', tb)
      const j = await fetch(`/api/admin/tests?${params}`).then(r => r.json())
      setTests(j.data ?? [])
      const cnt = j.count ?? 0
      setTotal(cnt)
      if (pg === 0 && !s && !cat && !tb) setAllTotal(cnt)
    } finally {
      setLoading(false)
    }
  }, [])

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
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          getHref={(t) => `/catalog/${t.code}`}
        />
      </div>
    </main>
  )
}
