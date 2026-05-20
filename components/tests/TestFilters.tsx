'use client'

import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import type { Category } from '@/lib/supabase/types'

interface Props {
  search: string
  onSearch: (v: string) => void
  categoryId: string
  onCategoryChange: (v: string) => void
  tube: string
  onTubeChange: (v: string) => void
  categories: Category[]
  total: number
  filtered: number
}

const TUBE_OPTIONS = [
  { value: '', label: 'ทุก specimen' },
  'Sodium citrate (ฟ้า)',
  'Clotted blood (แดง)',
  'Lithium heparin (เขียว)',
  'EDTA (ม่วง)',
  'NaF (เทา)',
  'Urine',
  'Stool',
  'Hemoculture aerobic (ผู้ใหญ่)',
  'Hemoculture aerobic (เด็ก)',
  'Hemoculture fungi/TB',
  'Blood gas syringe',
  'Blood gas capillary tube',
  'Cowin tube',
  'Random urine',
  'อื่นๆ',
]

export function TestFilters({ search, onSearch, categoryId, onCategoryChange, tube, onTubeChange, categories, total, filtered }: Props) {
  const catOptions = [
    { value: '', label: 'ทุกหมวดหมู่' },
    ...categories.map((c) => ({ value: c.id, label: c.th })),
  ]

  return (
    <Card padding={14}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Input
            icon="search"
            value={search}
            onChange={onSearch}
            placeholder="ค้นหาชื่อ test, รหัส, รหัสกรมบัญชีกลาง..."
          />
        </div>
        <Select value={categoryId} onChange={onCategoryChange} options={catOptions} />
        <Select value={tube} onChange={onTubeChange} options={TUBE_OPTIONS} />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
        พบ <strong style={{ color: 'var(--ink)' }}>{filtered}</strong> รายการ
        {total !== filtered && <> จากทั้งหมด {total} รายการ</>}
      </div>
    </Card>
  )
}
