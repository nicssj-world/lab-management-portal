'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { TestFilters } from '@/components/tests/TestFilters'
import { TestTable } from '@/components/tests/TestTable'
import { createClient } from '@/lib/supabase/client'
import { getCategories } from '@/lib/queries/categories'
import type { Test, Category } from '@/lib/supabase/types'

const PAGE_SIZE = 20

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tube, setTube] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [allTotal, setAllTotal] = useState(0)
  const [canEdit, setCanEdit] = useState(false)
  const [sortBy, setSortBy] = useState('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deletedCount, setDeletedCount] = useState(0)
  const [purging, setPurging] = useState(false)
  const timer = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        const edit = ['Admin', 'Manager'].includes(p?.role ?? '')
        setCanEdit(edit)
        if (edit) {
          fetch('/api/admin/tests/purge-deleted')
            .then(r => r.json())
            .then(d => setDeletedCount(d.count ?? 0))
            .catch(() => {})
        }
      }
      getCategories(supabase, false).then(setCategories)
    }
    init()
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

  async function handleDelete(id: number) {
    if (!confirm('ยืนยันการลบงานรายการนี้?')) return
    const res = await fetch(`/api/admin/tests/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTests(prev => prev.filter(t => t.id !== id))
      setTotal(prev => prev - 1)
      setAllTotal(prev => Math.max(0, prev - 1))
      setDeletedCount(prev => prev + 1)
    }
  }

  async function handlePurge() {
    if (!confirm(`ยืนยันการลบถาวร ${deletedCount} รายการที่ถูกลบออกจากฐานข้อมูล? การกระทำนี้ไม่สามารถกู้คืนได้`)) return
    setPurging(true)
    const res = await fetch('/api/admin/tests/purge-deleted', { method: 'DELETE' })
    const data = await res.json()
    setPurging(false)
    if (res.ok) {
      setDeletedCount(0)
      alert(`ลบถาวรแล้ว ${data.purged} รายการ`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="ค้นหา"
        title="รายการตรวจวิเคราะห์"
        subtitle={`ทั้งหมด ${allTotal} รายการ`}
        actions={canEdit
          ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {deletedCount > 0 && (
                <button
                  onClick={handlePurge}
                  disabled={purging}
                  style={{
                    fontSize: 12, padding: '6px 12px', borderRadius: 7,
                    border: '1px solid #FECACA', background: 'transparent',
                    color: '#B91C1C', cursor: purging ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', fontWeight: 500,
                    opacity: purging ? 0.6 : 1,
                  }}
                >
                  {purging ? 'กำลังลบ...' : `ล้างรายการที่ถูกลบ (${deletedCount})`}
                </button>
              )}
              <Link href="/staff/tests/import" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" size="sm" icon="download">นำเข้า Excel</Button>
              </Link>
              <Link href="/staff/tests/new" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm" icon="plus">เพิ่มรายการตรวจ</Button>
              </Link>
            </div>
          : undefined}
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
        canEdit={canEdit}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={handlePageChange}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        onDelete={handleDelete}
        onBulkDelete={(ids) => {
          setTests(prev => prev.filter(t => !ids.includes(t.id)))
          setTotal(prev => prev - ids.length)
          setAllTotal(prev => Math.max(0, prev - ids.length))
        }}
      />
    </div>
  )
}
