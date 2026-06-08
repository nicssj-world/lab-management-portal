'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { TestDetailCard } from '@/components/tests/TestDetailCard'
import { SpecimenSection } from '@/components/tests/SpecimenSection'
import { RefRangeModal } from '@/components/tests/RefRangeModal'
import { isJsonTable } from '@/components/tests/ReferenceRangePaste'
import { DocDownloadButton } from '@/components/tests/DocDownloadButton'
import { createClient } from '@/lib/supabase/client'
import { usePermission } from '@/context/PermissionContext'
import { canDeleteTests, canEditTests } from '@/lib/tests/permissions'
import type { TestDetail, Category } from '@/lib/supabase/types'

const DOC_TYPE_COLOR: Record<string, string> = {
  QP: '#2563EB', WI: '#059669', RF: '#DC2626', Form: '#D97706',
  'Method Validation': '#7C3AED', 'Method Correlation': '#0891B2',
  'Measurement Uncertainty': '#065F46', Other: '#6B7280',
}

export default function TestDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [actor, setActor] = useState<{ role: string; doc_role?: string | null } | null>(null)
  const [detail, setDetail] = useState<TestDetail | null>(null)
  const [category, setCategory] = useState<Category | undefined>()
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const supabase = createClient()
  const testPerm = usePermission('รายการตรวจ')
  const canModifyTests = canEditTests(actor, testPerm.level)
  const canRemoveTests = canDeleteTests(actor, testPerm.level)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    async function load() {
      fetch('/api/me')
        .then(r => r.ok ? r.json() : null)
        .then(me => setActor(me ? { role: me.role, doc_role: me.doc_role } : null))
        .catch(() => setActor(null))

      const res = await fetch(`/api/admin/tests/${id}`)
      const json: TestDetail = await res.json()
      setDetail(json)
      if (json.test?.category_id) {
        const { data: cat } = await supabase.from('categories').select('*').eq('id', json.test.category_id).single()
        setCategory(cat ?? undefined)
      }
      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/admin/tests/${id}/duplicate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เกิดข้อผิดพลาด')
      showToast(`สร้างสำเนาสำเร็จ: ${json.code}`)
      setTimeout(() => router.push(`/staff/tests/${json.id}`), 1200)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/tests/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('ไม่สามารถลบได้')
      router.push('/staff/tests')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--muted)' }}>กำลังโหลด...</div>
  }

  if (!detail) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>ไม่พบข้อมูล</div>
  }

  const { test, referenceRanges, documents } = detail

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#166534', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
          ✓ {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
        <Link href="/staff" style={{ color: 'var(--muted)', textDecoration: 'none' }}>หน้าแรก</Link>
        <Icon name="chevRight" size={14} />
        <Link href="/staff/tests" style={{ color: 'var(--muted)', textDecoration: 'none' }}>รายการตรวจ</Link>
        <Icon name="chevRight" size={14} />
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{test.th}</span>
      </div>

      {/* Header card */}
      <Card padding={24}>
        <TestDetailCard test={test} category={category} />
        {canModifyTests && (
          <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <Link href={`/staff/tests/${id}/edit`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm" icon="edit">แก้ไข</Button>
            </Link>
            <Button variant="ghost" size="sm" icon="doc" onClick={handleDuplicate} disabled={duplicating}>
              {duplicating ? 'กำลังคัดลอก...' : 'คัดลอก'}
            </Button>
            {canRemoveTests && (
              <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirmDelete(true)}>ลบ</Button>
            )}
          </div>
        )}
      </Card>

      {/* Body: 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(test.method || test.methodology_note || test.service) && (
            <Card padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Icon name="microscope" size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>วิธีการตรวจวิเคราะห์</span>
              </div>
              {[
                { label: 'หลักการทดสอบ', val: test.method },
                { label: 'วัน-เวลาที่ตรวจวิเคราะห์', val: test.available_24hr ? 'ตลอด 24 ชั่วโมง' : test.service },
                { label: 'วัตถุประสงค์/ข้อบ่งชี้ (Indication)', val: test.methodology_note },
              ].filter(r => r.val).map(r => (
                <div key={r.label} style={{ display: 'flex', gap: 16, paddingBlock: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 130, flexShrink: 0 }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{r.val}</span>
                </div>
              ))}
            </Card>
          )}

          <Card padding={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Icon name="chart" size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>ค่าอ้างอิง (Reference Range)</span>
            </div>
            {referenceRanges.length > 0 || isJsonTable(test.ref)
              ? <RefRangeModal ranges={referenceRanges} tableJson={test.ref} refNote={test.ref_note} />
              : test.ref
                ? <>
                    <div style={{ fontSize: 15, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{test.ref}</div>
                    {test.ref_note && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                        <Icon name="alert" size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ whiteSpace: 'pre-wrap' }}>{test.ref_note}</span>
                      </div>
                    )}
                  </>
                : <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไม่มีข้อมูลค่าอ้างอิง</div>
            }
          </Card>

          <Card padding={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Icon name="flask" size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>การเก็บตัวอย่าง</span>
            </div>
            <SpecimenSection test={test} />
          </Card>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card padding={16}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>เอกสารที่เกี่ยวข้อง</div>
            {documents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่มีเอกสาร</div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 8, borderBottom: '1px solid var(--border)' }}>
                  <Icon name="doc" size={14} style={{ color: '#2563EB', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{doc.name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                    background: (DOC_TYPE_COLOR[doc.doc_type] ?? '#6B7280') + '18',
                    color: DOC_TYPE_COLOR[doc.doc_type] ?? '#6B7280',
                  }}>{doc.doc_type}</span>
                  <DocDownloadButton testId={Number(id)} docId={doc.id} docName={doc.name} />
                </div>
              ))
            )}
          </Card>

          {(test.contact_name || test.contact_phone || test.contact_email || test.contact_note) && (
            <Card padding={16}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>ติดต่อ</div>
              {test.contact_name && (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{test.contact_name}</div>
              )}
              {test.contact_note && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>{test.contact_note}</div>
              )}
              {test.contact_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
                  <Icon name="phone" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  {test.contact_phone}
                </div>
              )}
              {test.contact_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2563EB' }}>
                  <Icon name="mail" size={13} style={{ flexShrink: 0 }} />
                  <a href={`mailto:${test.contact_email}`} style={{ color: '#2563EB', textDecoration: 'none' }}>{test.contact_email}</a>
                </div>
              )}
            </Card>
          )}

          <Card padding={16}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>แก้ไขล่าสุด</div>
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>
              {new Date(test.updated_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </Card>

          <Button variant="secondary" size="md" icon="download" full onClick={() => window.print()}>
            พิมพ์ / ส่งออก PDF
          </Button>
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>ยืนยันการปิดใช้งาน</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
              ต้องการปิดใช้งานรายการตรวจ <strong>{test.code}</strong> ใช่หรือไม่?<br />
              รายการจะถูกซ่อนแต่ยังคงอยู่ในระบบ
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>ยกเลิก</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
