'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTests, deleteTest, upsertTest } from '@/lib/queries/tests'
import { getCategories } from '@/lib/queries/categories'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tube } from '@/components/lab/Tube'
import type { Test, Category } from '@/lib/supabase/types'

const TUBE_COLORS: Record<string, string> = {
  EDTA: '#9333EA', SST: '#F59E0B', Citrate: '#3B82F6',
  Heparin: '#10B981', Plain: '#EF4444', Urine: '#F97316', CSF: '#6B7280', Swab: '#EC4899',
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const supabase = createClient()

  async function load() {
    const [{ data }, cats] = await Promise.all([
      getTests(supabase, { pageSize: 500 }),
      getCategories(supabase),
    ])
    setTests(data)
    setCategories(cats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() =>
    tests.filter((t) => {
      if (cat !== 'all' && t.category_id !== cat) return false
      if (q) {
        const ql = q.toLowerCase()
        return t.code.toLowerCase().includes(ql) || t.th.includes(q) || t.en.toLowerCase().includes(ql)
      }
      return true
    }),
    [tests, q, cat]
  )

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const catOptions = [{ value: 'all', label: 'ทุกหมวดหมู่' }, ...categories.map((c) => ({ value: c.id, label: c.th }))]

  async function handleToggleActive(test: Test) {
    await upsertTest(supabase, { ...test, active: !test.active })
    setTests((prev) => prev.map((t) => t.id === test.id ? { ...t, active: !t.active } : t))
  }

  async function handleDelete(id: number) {
    if (!confirm('ยืนยันการลบรายการนี้?')) return
    await deleteTest(supabase, id)
    setTests((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="จัดการ"
        title="รายการตรวจวิเคราะห์"
        subtitle={`ทั้งหมด ${tests.length} รายการ`}
        actions={
          <Button variant="primary" icon="plus">เพิ่มรายการตรวจ</Button>
        }
      />

      <Card padding={14}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input icon="search" value={q} onChange={setQ} placeholder="ค้นหาชื่อ, รหัส, LOINC…" />
          </div>
          <Select value={cat} onChange={setCat} options={catOptions} />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
          {loading ? 'กำลังโหลด...' : `พบ ${filtered.length} รายการ`}
          {selectedIds.size > 0 && ` · เลือกแล้ว ${selectedIds.size} รายการ`}
        </div>
      </Card>

      {!loading && filtered.length === 0 ? (
        <EmptyState icon="flask" title="ไม่พบรายการ" hint="ลองเปลี่ยนคำค้นหา" />
      ) : (
        <Card padding={0}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  {['', 'รหัส', 'ชื่อรายการตรวจ', 'หมวดหมู่', 'Specimen', 'TAT', 'ราคา', 'สถานะ', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '11px 14px', fontSize: 11.5, fontWeight: 600,
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
                {filtered.map((t) => {
                  const c = catMap[t.category_id ?? '']
                  const tubeColor = TUBE_COLORS[t.tube ?? ''] ?? '#94A3B8'
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds)
                            e.target.checked ? next.add(t.id) : next.delete(t.id)
                            setSelectedIds(next)
                          }}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{t.code}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.th}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{t.en}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {c && <Badge color="gray" size="sm">{c.th}</Badge>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <Tube color={tubeColor} label={t.tube ?? ''} />
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{t.tat}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)' }}>
                        {t.price ? `฿${t.price}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge color={t.active ? 'green' : 'gray'} size="sm">{t.active ? 'ใช้งาน' : 'ปิดใช้'}</Badge>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleToggleActive(t)}
                            style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}
                          >
                            {t.active ? 'ปิด' : 'เปิด'}
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
