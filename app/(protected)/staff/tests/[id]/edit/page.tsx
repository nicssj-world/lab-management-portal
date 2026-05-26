'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { TestForm } from '@/components/tests/TestForm'
import { createClient } from '@/lib/supabase/client'
import { getCategories } from '@/lib/queries/categories'
import type { Category, TestDetail } from '@/lib/supabase/types'
import type { TestFormData, ReferenceRangeRow } from '@/lib/validations/test-schema'

export default function EditTestPage() {
  const { id } = useParams() as { id: string }
  const [categories, setCategories] = useState<Category[]>([])
  const [detail, setDetail] = useState<TestDetail | null>(null)
  const [existingTests, setExistingTests] = useState<{ id: number; code: string; th: string; category_id: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [cats, res] = await Promise.all([
        getCategories(supabase, false),
        fetch(`/api/admin/tests/${id}`),
      ])
      fetch('/api/admin/tests?pageSize=10000&sortBy=code')
        .then((r) => r.ok ? r.json() : { data: [] })
        .then((j) => setExistingTests(Array.isArray(j.data) ? j.data.map((t: { id: number; code: string; th: string; category_id: string | null }) => ({
          id: t.id,
          code: t.code,
          th: t.th,
          category_id: t.category_id,
        })) : []))
        .catch(() => setExistingTests([]))
      setCategories(cats)
      const json: TestDetail = await res.json()
      setDetail(json)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลด...</div>
  if (!detail) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>ไม่พบข้อมูล</div>

  const { test, referenceRanges } = detail

  const rangesData: ReferenceRangeRow[] = referenceRanges.map(r => ({
    id: r.id,
    gender: r.gender,
    min_age: r.min_age,
    max_age: r.max_age,
    lower_limit: r.lower_limit,
    upper_limit: r.upper_limit,
    unit: r.unit ?? undefined,
    note: r.note ?? undefined,
    sort_order: r.sort_order,
  }))

  const formData: Partial<TestFormData> = {
    code: test.code,
    lis_code: test.lis_code ?? undefined,
    category_id: test.category_id ?? '',
    th: test.th,
    en: test.en ?? undefined,
    cgd: test.cgd ?? undefined,
    loinc: test.loinc ?? undefined,
    short_name: test.short_name ?? undefined,
    description: test.description ?? undefined,
    department: test.department ?? undefined,
    active: test.active,
    popular: test.popular,
    price: test.price ?? undefined,
    tat_minutes: test.tat_minutes ?? undefined,
    urgent_tat_minutes: test.urgent_tat_minutes ?? undefined,
    available_24hr: test.available_24hr ?? false,
    service: test.service ?? undefined,
    method: test.method ?? undefined,
    instrument: test.instrument ?? undefined,
    methodology_note: test.methodology_note ?? undefined,
    tube: test.tube ?? undefined,
    tube_color: test.tube_color ?? undefined,
    volume: test.volume ?? undefined,
    stability: test.stability ?? undefined,
    transport_condition: test.transport_condition ?? undefined,
    reject: test.reject ?? undefined,
    specimen_note: test.specimen_note ?? undefined,
    contact_name: test.contact_name ?? undefined,
    contact_phone: test.contact_phone ?? undefined,
    contact_email: test.contact_email ?? undefined,
    contact_note: test.contact_note ?? undefined,
    ref: test.ref ?? undefined,
    ref_note: test.ref_note ?? undefined,
  }


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        <Link href="/staff/tests" style={{ color: 'var(--muted)', textDecoration: 'none' }}>รายการตรวจ</Link>
        <Icon name="chevRight" size={14} />
        <Link href={`/staff/tests/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{test.th}</Link>
        <Icon name="chevRight" size={14} />
        <span style={{ color: 'var(--ink)' }}>แก้ไข</span>
      </div>
      <PageHeader eyebrow="แก้ไข" title={test.th} subtitle={test.code} />
      <TestForm
        categories={categories}
        testId={Number(id)}
        initial={formData}
        initialRanges={rangesData}
        existingTests={existingTests}
      />
    </div>
  )
}
