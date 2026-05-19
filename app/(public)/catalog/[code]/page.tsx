import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTestByCode } from '@/lib/queries/tests'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Tube } from '@/components/lab/Tube'

const TUBE_COLORS: Record<string, { color: string; label: string }> = {
  'EDTA':    { color: '#9333EA', label: 'EDTA (ม่วง)' },
  'SST':     { color: '#F59E0B', label: 'SST (เหลือง)' },
  'Citrate': { color: '#3B82F6', label: 'Citrate (น้ำเงิน)' },
  'Heparin': { color: '#10B981', label: 'Heparin (เขียว)' },
  'Plain':   { color: '#EF4444', label: 'Plain (แดง)' },
  'Urine':   { color: '#F97316', label: 'ปัสสาวะ' },
  'CSF':     { color: '#6B7280', label: 'CSF' },
  'Swab':    { color: '#EC4899', label: 'Swab' },
}

interface Props {
  params: Promise<{ code: string }>
}

export default async function TestDetailPage({ params }: Props) {
  const { code } = await params
  const supabase = await createClient()
  const test = await getTestByCode(supabase, code)

  if (!test) notFound()

  const tubeInfo = TUBE_COLORS[test.tube ?? ''] ?? { color: '#94A3B8', label: test.tube ?? '' }
  const cat = (test as any).categories

  const fields = [
    { label: 'รหัสการทดสอบ', value: test.code },
    { label: 'รหัสกรมบัญชีกลาง', value: test.cgd },
    { label: 'LOINC', value: test.loinc },
    { label: 'วิธีการตรวจ', value: test.method },
    { label: 'Specimen / ปริมาณ', value: test.volume ? `${test.tube} · ${test.volume}` : test.tube },
    { label: 'TAT', value: test.tat },
    { label: 'ราคา', value: test.price ? `฿${test.price}` : undefined },
    { label: 'Stability', value: test.stability },
    { label: 'เหตุผลปฏิเสธตัวอย่าง', value: test.reject },
    { label: 'ค่าอ้างอิง', value: test.ref },
    { label: 'Priority', value: test.priority },
    { label: 'ประเภทบริการ', value: test.service },
  ]

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px 60px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>หน้าแรก</Link>
          <Icon name="chevRight" size={12} />
          <Link href="/catalog" style={{ color: 'var(--muted)', textDecoration: 'none' }}>รายการตรวจ</Link>
          <Icon name="chevRight" size={12} />
          <span style={{ color: 'var(--ink)' }}>{test.code}</span>
        </div>

        <Card padding={28} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <Badge color="blue" style={{ fontFamily: 'monospace' }}>{test.code}</Badge>
                {test.cgd && <Badge color="teal" style={{ fontFamily: 'monospace' }}>CGD {test.cgd}</Badge>}
                {test.loinc && <Badge color="gray">LOINC {test.loinc}</Badge>}
                {cat && <Badge color="gray">{cat.th}</Badge>}
                {test.priority === 'STAT' && <Badge color="red">STAT</Badge>}
                {test.priority === 'STAT-eligible' && <Badge color="amber">STAT-eligible</Badge>}
              </div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {test.th}
              </h1>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 15 }}>{test.en}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Tube color={tubeInfo.color} label={tubeInfo.label} size="lg" />
              {test.price && (
                <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>
                  ฿{test.price}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {fields.filter((f) => f.value).map((f) => (
              <div key={f.label} style={{ background: 'var(--card)', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{f.value}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ marginTop: 24 }}>
          <Link href="/catalog" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="arrowLeft" size={14} />
            กลับไปรายการตรวจ
          </Link>
        </div>
      </div>
    </main>
  )
}
