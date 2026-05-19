'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCategories, upsertCategory, deleteCategory, reorderCategories } from '@/lib/queries/categories'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import type { Category } from '@/lib/supabase/types'

const COLOR_OPTIONS = [
  '#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C', '#0891B2',
  '#BE185D', '#0F766E', '#7C3AED', '#475569', '#D97706', '#6366F1',
]

const ICON_OPTIONS = ['flask', 'beaker', 'blood', 'shieldCheck', 'droplet', 'dna', 'microscope', 'chart', 'doc', 'shield', 'alert', 'pill']

interface ModalState { open: boolean; cat: Category | null }

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ open: false, cat: null })
  const [draft, setDraft] = useState<Partial<Category>>({})
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const supabase = createClient()

  async function load() {
    const cats = await getCategories(supabase)
    setCategories(cats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setDraft({ id: '', th: '', en: '', color: COLOR_OPTIONS[0], icon: 'flask', active: true, sort_order: categories.length })
    setModal({ open: true, cat: null })
  }

  function openEdit(cat: Category) {
    setDraft({ ...cat })
    setModal({ open: true, cat })
  }

  async function handleSave() {
    if (!draft.id || !draft.th || !draft.en) return
    await upsertCategory(supabase, draft as Category & { id: string })
    setModal({ open: false, cat: null })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('ยืนยันการลบหมวดหมู่นี้?')) return
    await deleteCategory(supabase, id)
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
    await reorderCategories(supabase, categories.map((c) => c.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="จัดการ"
        title="หมวดหมู่การตรวจวิเคราะห์"
        subtitle={`${categories.length} หมวดหมู่ · ลากเพื่อเรียงลำดับ`}
        actions={<Button variant="primary" icon="plus" onClick={openNew}>เพิ่มหมวดหมู่</Button>}
      />

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
              style={{ opacity: dragIdx === idx ? 0.5 : 1, cursor: 'grab' }}
            >
              <Card padding={18}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `${cat.color}22`, color: cat.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name={cat.icon} size={22} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openEdit(cat)}
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{cat.th}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{cat.en}</div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <code style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{cat.id}</code>
                  <Badge color={cat.active ? 'green' : 'gray'} size="sm">{cat.active ? 'ใช้งาน' : 'ปิด'}</Badge>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
          onClick={() => setModal({ open: false, cat: null })}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {modal.cat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
              </div>
              <button onClick={() => setModal({ open: false, cat: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Preview */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${draft.color}22`, color: draft.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={draft.icon ?? 'flask'} size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{draft.th || 'ชื่อหมวด (ไทย)'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{draft.en || 'EN name'} · <code>{draft.id || 'id'}</code></div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>ชื่อ (ไทย) *</label>
                  <Input value={draft.th ?? ''} onChange={(v) => setDraft({ ...draft, th: v })} placeholder="เคมีคลินิก" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>ชื่อ (อังกฤษ) *</label>
                  <Input value={draft.en ?? ''} onChange={(v) => setDraft({ ...draft, en: v })} placeholder="Chemistry" />
                </div>
              </div>

              {!modal.cat && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>รหัสหมวดหมู่ (ID) *</label>
                  <Input value={draft.id ?? ''} onChange={(v) => setDraft({ ...draft, id: v.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="chem" />
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>สี</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraft({ ...draft, color: c })}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: draft.color === c ? '3px solid var(--ink)' : '2px solid transparent',
                        background: c, cursor: 'pointer', padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>ไอคอน</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setDraft({ ...draft, icon: ic })}
                      style={{
                        width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: draft.icon === ic ? 'var(--primary-soft)' : 'var(--surface-2)',
                        color: draft.icon === ic ? 'var(--primary)' : 'var(--muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon name={ic} size={18} />
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
                <Button variant="ghost" onClick={() => setModal({ open: false, cat: null })}>ยกเลิก</Button>
                <Button variant="primary" onClick={handleSave} disabled={!draft.id || !draft.th || !draft.en}>บันทึก</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
