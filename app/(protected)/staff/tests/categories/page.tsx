'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import type { Category } from '@/lib/supabase/types'

const COLOR_OPTIONS = [
  '#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C', '#0891B2',
  '#BE185D', '#B91C1C', '#065F46', '#7C3AED', '#475569', '#D97706', '#818CF8',
]

const ICON_OPTIONS = [
  'flask', 'beaker', 'blood', 'petri', 'shield', 'syringe', 'cup', 'droplet', 'bloodBag', 'dna',
  'cell', 'microscope', 'biohazard', 'pill', 'chart', 'doc', 'shieldCheck', 'alert', 'eye',
]

type CategoryWithCount = Category & { testCount: number }
interface ModalState { open: boolean; cat: CategoryWithCount | null }

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6,
}
const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState<ModalState>({ open: false, cat: null })
  const [draft, setDraft]           = useState<Partial<Category>>({})
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [dragIdx, setDragIdx]       = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/categories')
    if (res.ok) {
      const data = await res.json()
      setCategories(data.map((c: Category & { tests?: { count: number }[] }) => ({
        ...c,
        testCount: c.tests?.[0]?.count ?? 0,
      })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setDraft({ id: '', th: '', en: '', color: COLOR_OPTIONS[0], icon: 'flask', active: true, sort_order: categories.length })
    setModal({ open: true, cat: null })
  }

  function openEdit(cat: CategoryWithCount) {
    const { testCount: _, ...rest } = cat
    setDraft({ ...rest })
    setModal({ open: true, cat })
  }

  function closeModal() { setModal({ open: false, cat: null }); setSaveError(null) }

  async function handleSave() {
    if (!draft.id || !draft.th || !draft.en) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `Error ${res.status}`)
      }
      closeModal()
      load()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(cat: CategoryWithCount) {
    const updated = { ...cat, active: !cat.active }
    const { testCount: _, ...payload } = updated
    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, active: !c.active } : c))
    await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('ยืนยันการลบหมวดหมู่นี้?')) return
    await fetch('/api/admin/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const next = [...categories]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setCategories(next)
    setDragIdx(idx)
  }
  async function handleDragEnd() {
    setDragIdx(null)
    await fetch('/api/admin/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: categories.map((c) => c.id) }),
    })
  }

  function handleExport() {
    const rows = [
      ['ID', 'ชื่อไทย', 'ชื่ออังกฤษ', 'สถานะ', 'รายการตรวจ'],
      ...categories.map((c) => [c.id, c.th, c.en, c.active ? 'Active' : 'Inactive', String(c.testCount)]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'categories.csv'
    a.click()
  }

  const totalTests  = categories.reduce((s, c) => s + c.testCount, 0)
  const activeCount = categories.filter((c) => c.active).length
  const avgTests    = categories.length ? Math.round(totalTests / categories.length) : 0

  const STATS = [
    { label: 'หมวดทั้งหมด',    value: categories.length, icon: 'beaker', color: '#2563EB' },
    { label: 'เปิดให้บริการ',  value: activeCount,       icon: 'check',  color: '#16A34A' },
    { label: 'รายการตรวจรวม', value: totalTests,          icon: 'flask',  color: '#7C3AED' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow={`${categories.length} หมวด · ${totalTests} รายการตรวจ`}
        title="หมวดหมู่การตรวจวิเคราะห์"
        subtitle="จัดการหมวดหมู่ที่แสดงในหน้า public และใช้จัดกลุ่มรายการตรวจ"
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={handleExport}>ส่งออก</Button>
            <Button variant="primary"   icon="plus"     onClick={openNew}>เพิ่มหมวดหมู่</Button>
          </>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {STATS.map(({ label, value, icon, color }) => (
          <Card key={label} padding={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>{loading ? '—' : value}</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={18} />
              </div>
            </div>
          </Card>
        ))}
      </div>

{/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              style={{ opacity: dragIdx === idx ? 0.45 : 1, transition: 'opacity .15s' }}
            >
              <Card padding={16}>
                {/* Top row: icon + drag handle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cat.color}1A`, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={cat.icon} size={22} />
                  </div>
                  <div style={{ cursor: 'grab', color: 'var(--muted)', padding: '4px 2px', lineHeight: 1 }}>
                    <Icon name="menu" size={16} />
                  </div>
                </div>

                {/* Name */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{cat.th}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{cat.en} · {cat.id}</div>
                </div>

                {/* Bottom row: count + badge + action icons */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{cat.testCount} รายการ</span>
                    <Badge color={cat.active ? 'green' : 'gray'} size="sm">{cat.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      style={{ ...iconBtnStyle, color: cat.active ? '#16A34A' : 'var(--muted)', borderColor: cat.active ? '#BBF7D0' : 'var(--border)' }}
                      title={cat.active ? 'ปิดการเผยแพร่' : 'เปิดการเผยแพร่'}
                      onClick={() => handleToggleActive(cat)}
                    >
                      <Icon name="eye" size={14} />
                    </button>
                    <button style={iconBtnStyle} title="แก้ไข" onClick={() => openEdit(cat)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button style={{ ...iconBtnStyle, color: '#DC2626', borderColor: '#FEE2E2' }} title="ลบ" onClick={() => handleDelete(cat.id)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          ))}

          {/* Add card */}
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 8, minHeight: 148,
              borderRadius: 12, border: '2px dashed var(--border)',
              background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 13,
              transition: 'border-color .15s, color .15s', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.color = 'var(--muted)' }}
          >
            <Icon name="plus" size={22} />
            <span>เพิ่มหมวดหมู่ใหม่</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}
          >
            {/* Modal header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  {modal.cat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                  {modal.cat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="x" size={15} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Preview */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>ตัวอย่าง</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 18px', background: 'var(--surface-2)', borderRadius: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${draft.color}1A`, color: draft.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={draft.icon ?? 'flask'} size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 15 }}>{draft.th || 'ชื่อหมวด (ไทย)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {draft.en || 'EN name'} · <code style={{ fontSize: 11 }}>{draft.id || 'id'}</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Name fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>ชื่อ (ไทย) <span style={{ color: '#DC2626' }}>*</span></label>
                  <Input value={draft.th ?? ''} onChange={(v) => setDraft({ ...draft, th: v })} placeholder="เคมีคลินิก" />
                </div>
                <div>
                  <label style={labelStyle}>ชื่อ (อังกฤษ) <span style={{ color: '#DC2626' }}>*</span></label>
                  <Input value={draft.en ?? ''} onChange={(v) => setDraft({ ...draft, en: v })} placeholder="Chemistry" />
                </div>
              </div>

              {/* ID field — only on create */}
              {!modal.cat && (
                <div>
                  <label style={labelStyle}>รหัสหมวดหมู่ (ID) <span style={{ color: '#DC2626' }}>*</span></label>
                  <Input
                    value={draft.id ?? ''}
                    onChange={(v) => setDraft({ ...draft, id: v.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    placeholder="e.g. chem, hema, mole"
                  />
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>ตัวอักษรอังกฤษพิมพ์เล็ก ไม่เว้นวรรค ใช้อ้างอิงในระบบ</div>
                </div>
              )}

              {/* Color picker */}
              <div>
                <label style={labelStyle}>สี</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraft({ ...draft, color: c })}
                      style={{
                        width: 32, height: 32, borderRadius: 8, padding: 0, cursor: 'pointer',
                        background: c,
                        border: draft.color === c ? '3px solid var(--ink)' : '2px solid transparent',
                        boxSizing: 'border-box',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <label style={labelStyle}>ไอคอน</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setDraft({ ...draft, icon: ic })}
                      style={{
                        width: 40, height: 40, borderRadius: 8, padding: 0, cursor: 'pointer',
                        border: draft.icon === ic ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: draft.icon === ic ? 'var(--primary-soft)' : 'var(--card)',
                        color: draft.icon === ic ? 'var(--primary)' : 'var(--muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background .12s, border-color .12s',
                      }}
                    >
                      <Icon name={ic} size={18} />
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>เลือกจากชุดไอคอนที่มีในระบบ</div>
              </div>

              {/* Active toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={draft.active ?? true}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  เปิดให้บริการ <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(แสดงในหน้าเว็บ public)</span>
                </span>
              </label>

              {/* Save error */}
              {saveError && (
                <div style={{ fontSize: 12.5, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px' }}>
                  {saveError}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <Button variant="ghost" onClick={closeModal}>ยกเลิก</Button>
                <Button
                  variant="primary"
                  icon={modal.cat ? undefined : 'plus'}
                  onClick={handleSave}
                  disabled={saving || !draft.id || !draft.th || !draft.en}
                >
                  {saving ? 'กำลังบันทึก…' : modal.cat ? 'บันทึก' : 'เพิ่มหมวดหมู่'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
