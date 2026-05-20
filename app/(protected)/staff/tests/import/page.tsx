'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { TestImport } from '@/components/tests/TestImport'
import { getCategories } from '@/lib/queries/categories'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/supabase/types'

export default function ImportTestPage() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    getCategories(createClient(), false).then(setCategories)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
        <Link href="/staff/tests" style={{ color: 'var(--muted)', textDecoration: 'none' }}>รายการตรวจ</Link>
        <Icon name="chevRight" size={14} />
        <span style={{ color: 'var(--ink)' }}>นำเข้าจาก Excel</span>
      </div>
      <PageHeader eyebrow="Import" title="นำเข้ารายการตรวจจาก Excel" />
      <TestImport categories={categories} />
    </div>
  )
}
