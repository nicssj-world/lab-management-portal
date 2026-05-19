'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getTests } from '@/lib/queries/tests'
import { getCategories } from '@/lib/queries/categories'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Tube } from '@/components/lab/Tube'
import type { Test } from '@/lib/supabase/types'
import type { Category } from '@/lib/supabase/types'

const TUBE_COLORS: Record<string, { color: string; label: string }> = {
  'EDTA':      { color: '#9333EA', label: 'EDTA (ม่วง)' },
  'SST':       { color: '#F59E0B', label: 'SST (เหลือง)' },
  'Citrate':   { color: '#3B82F6', label: 'Citrate (น้ำเงิน)' },
  'Heparin':   { color: '#10B981', label: 'Heparin (เขียว)' },
  'Plain':     { color: '#EF4444', label: 'Plain (แดง)' },
  'Urine':     { color: '#F97316', label: 'ปัสสาวะ' },
  'CSF':       { color: '#6B7280', label: 'CSF' },
  'Swab':      { color: '#EC4899', label: 'Swab' },
}

export default function CatalogPage() {
  const searchParams = useSearchParams()
  const [tests, setTests] = useState<Test[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(searchParams.get('cat') ?? 'all')
  const [tube, setTube] = useState('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data }, cats] = await Promise.all([
        getTests(supabase, { pageSize: 500 }),
        getCategories(supabase),
      ])
      setTests(data)
      setCategories(cats)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (cat !== 'all' && t.category_id !== cat) return false
      if (tube !== 'all' && t.tube !== tube) return false
      if (q) {
        const ql = q.toLowerCase()
        return (
          t.code.toLowerCase().includes(ql) ||
          t.th.includes(q) ||
          t.en.toLowerCase().includes(ql) ||
          (t.loinc ?? '').includes(q) ||
          (t.cgd ?? '').includes(q)
        )
      }
      return true
    })
  }, [tests, q, cat, tube])

  const catOptions = [
    { value: 'all', label: 'ทุกหมวดหมู่' },
    ...categories.map((c) => ({ value: c.id, label: c.th })),
  ]

  const tubeOptions = [
    { value: 'all', label: 'ทุก specimen' },
    ...Object.entries(TUBE_COLORS).map(([k, v]) => ({ value: k, label: v.label })),
  ]

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px' }}>
        <PageHeader
          eyebrow="ค้นหา"
          title="รายการตรวจวิเคราะห์"
          subtitle={`ทั้งหมด ${tests.length}+ รายการ`}
        />

        <Card padding={14} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <Input
                icon="search"
                value={q}
                onChange={(v) => { setQ(v); setPage(0) }}
                placeholder="ค้นหาชื่อ test, รหัส, กรมบัญชี, LOINC…"
              />
            </div>
            <Select value={cat} onChange={(v) => { setCat(v); setPage(0) }} options={catOptions} />
            <Select value={tube} onChange={(v) => { setTube(v); setPage(0) }} options={tubeOptions} />
            <div style={{ display: 'flex', gap: 4, border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
              {(['list', 'grid'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '5px 10px', fontSize: 12, border: 'none', borderRadius: 5,
                    background: view === v ? 'var(--primary-soft)' : 'transparent',
                    color: view === v ? 'var(--primary)' : 'var(--muted)',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
            {loading ? 'กำลังโหลด...' : `พบ ${filtered.length} รายการ`}
          </div>
        </Card>

        {!loading && filtered.length === 0 ? (
          <Card padding={0}>
            <EmptyState
              icon="flask"
              title="ไม่พบรายการในหมวดหมู่นี้"
              hint="ลองเลือกหมวดอื่น หรือล้างตัวกรอง"
            />
          </Card>
        ) : view === 'list' ? (
          <CatalogTable items={filtered} categories={categories} />
        ) : (
          <CatalogGrid items={filtered} categories={categories} />
        )}
      </div>
    </main>
  )
}

function CatalogTable({ items, categories }: { items: Test[]; categories: Category[] }) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  return (
    <Card padding={0}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              {['รหัสการทดสอบ', 'รหัสกรมบัญชีกลาง', 'ชื่อรายการตรวจ', 'LOINC', 'หมวดหมู่', 'Specimen', 'TAT', 'ราคา', ''].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '12px 16px', fontSize: 11.5, fontWeight: 600,
                    color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((t) => {
              const c = catMap[t.category_id ?? '']
              const tubeInfo = TUBE_COLORS[t.tube ?? ''] ?? { color: '#94A3B8', label: t.tube ?? '' }
              return (
                <tr key={t.code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{t.code}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--ink)' }}>{t.cgd}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/catalog/${t.code}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.th}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.en}</div>
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--muted)' }}>{t.loinc}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {c && <Badge color="gray" size="sm">{c.th}</Badge>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Tube color={tubeInfo.color} label={tubeInfo.label} />
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ink)' }}>{t.tat}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink)' }}>
                    {t.price ? `฿${t.price}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/catalog/${t.code}`} style={{ color: 'var(--muted)' }}>
                      <Icon name="chevRight" size={16} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CatalogGrid({ items, categories }: { items: Test[]; categories: Category[] }) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {items.map((t) => {
        const c = catMap[t.category_id ?? '']
        const tubeInfo = TUBE_COLORS[t.tube ?? ''] ?? { color: '#94A3B8', label: '' }
        return (
          <Link key={t.code} href={`/catalog/${t.code}`} style={{ textDecoration: 'none' }}>
            <Card hoverable padding={18}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Badge color="blue" size="sm" style={{ fontFamily: 'monospace' }}>{t.code}</Badge>
                <Tube color={tubeInfo.color} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t.th}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.en}</div>
              <div
                style={{
                  marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{c?.th}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>TAT {t.tat}</span>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
