'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { TestForm } from '@/components/tests/TestForm'
import { createClient } from '@/lib/supabase/client'
import { getCategories } from '@/lib/queries/categories'
import type { Category } from '@/lib/supabase/types'

export default function NewTestPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [existingTests, setExistingTests] = useState<{ id: number; code: string; th: string; category_id: string | null }[]>([])

  useEffect(() => {
    const supabase = createClient()
    getCategories(supabase, false).then(setCategories)
    fetch('/api/admin/tests?pageSize=10000&sortBy=code')
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((j) => setExistingTests(Array.isArray(j.data) ? j.data.map((t: { id: number; code: string; th: string; category_id: string | null }) => ({
        id: t.id,
        code: t.code,
        th: t.th,
        category_id: t.category_id,
      })) : []))
      .catch(() => setExistingTests([]))
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        <Link href="/staff/tests" style={{ color: 'var(--muted)', textDecoration: 'none' }}>รายการตรวจ</Link>
        <Icon name="chevRight" size={14} />
        <span style={{ color: 'var(--ink)' }}>เพิ่มรายการตรวจใหม่</span>
      </div>
      <PageHeader eyebrow="รายการตรวจ" title="เพิ่มรายการตรวจใหม่" />
      <TestForm categories={categories} existingTests={existingTests} />
    </div>
  )
}
