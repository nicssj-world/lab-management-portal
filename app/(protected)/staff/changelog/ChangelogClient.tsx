'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangelogItem {
  id: string
  date: string
  category: string
  title: string
  description: string | null
  changed_by: string
  changed_by_id: string | null
  created_at: string
  updated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['เครื่องมือ', 'เอกสาร', 'ระบบ / Portal', 'ฐานข้อมูล', 'สิทธิ์ผู้ใช้', 'รายการตรวจ', 'อื่นๆ']

const CATEGORY_BADGE: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'red' | 'green' | 'gray'> = {
  'เครื่องมือ':     'blue',
  'เอกสาร':         'teal',
  'ระบบ / Portal':  'purple',
  'ฐานข้อมูล':      'amber',
  'สิทธิ์ผู้ใช้':   'red',
  'รายการตรวจ':     'green',
  'อื่นๆ':          'gray',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}

function today() {
  return new Date().toISOString().split('T')[0]
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts(t => [...t, { id, msg, ok }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function ChangelogModal({
  item,
  currentUserName,
  onClose,
  onSaved,
}: {
  item: Partial<ChangelogItem> | null
  currentUserName: string
  onClose: () => void
  onSaved: (saved: ChangelogItem) => void
}) {
  const isEdit = !!item?.id
  const [form, setForm] = useState<Partial<ChangelogItem>>(
    item ?? { date: today(), category: 'อื่นๆ', title: '', description: '', changed_by: currentUserName }
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: keyof ChangelogItem, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title?.trim()) { setErr('กรุณาระบุหัวข้อ'); return }
    if (!form.changed_by?.trim()) { setErr('กรุณาระบุผู้ดำเนินการ'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(
        isEdit ? `/api/admin/changelog/${item!.id}` : '/api/admin/changelog',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }
      )
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'เกิดข้อผิดพลาด'); return }
      onSaved(json as ChangelogItem)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการแก้ไข'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
          {err && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{err}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>วันที่ *</label>
              <input type="date" style={inputStyle} value={form.date ?? today()} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>หมวดหมู่ *</label>
              <select style={inputStyle} value={form.category ?? 'อื่นๆ'} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>หัวข้อ *</label>
            <input
              style={inputStyle}
              value={form.title ?? ''}
              onChange={e => set('title', e.target.value)}
              placeholder="เช่น เพิ่มเครื่องมือใหม่ 3 เครื่อง, แก้ไข SOP เล่ม 5"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>รายละเอียด / หมายเหตุ</label>
            <textarea
              style={{ ...inputStyle, height: 96, resize: 'vertical' }}
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value || null)}
              placeholder="อธิบายรายละเอียดของการแก้ไข..."
            />
          </div>

          <div>
            <label style={labelStyle}>ผู้ดำเนินการ *</label>
            <input
              style={inputStyle}
              value={form.changed_by ?? ''}
              onChange={e => set('changed_by', e.target.value)}
              placeholder="ชื่อผู้ที่ทำการแก้ไข"
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มรายการ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ item, onClose, onDeleted }: { item: ChangelogItem; onClose: () => void; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/admin/changelog/${item.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(item.id)
    else setLoading(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ลบรายการ</div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>ต้องการลบรายการ <strong>"{item.title}"</strong>?</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้</div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={handleDelete} disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'กำลังลบ...' : 'ลบรายการ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ChangelogClient({
  initialData,
  canEdit,
  currentUserName,
}: {
  initialData: ChangelogItem[]
  canEdit: boolean
  currentUserName: string
}) {
  const [items, setItems] = useState<ChangelogItem[]>(initialData)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState<ChangelogItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<ChangelogItem | null>(null)

  const { toasts, add: addToast } = useToast()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (categoryFilter) params.set('category', categoryFilter)
    fetch(`/api/admin/changelog?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setItems(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debouncedSearch, categoryFilter])

  function sortByDate(arr: ChangelogItem[]) {
    return [...arr].sort((a, b) =>
      b.date !== a.date ? b.date.localeCompare(a.date) : b.created_at.localeCompare(a.created_at)
    )
  }

  function handleSaved(saved: ChangelogItem) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
      const next = idx >= 0 ? prev.map((it, i) => i === idx ? saved : it) : [saved, ...prev]
      return sortByDate(next)
    })
    setAddModal(false); setEditItem(null)
    addToast(editItem ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการแล้ว')
  }

  function handleDeleted(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleteItem(null)
    addToast('ลบรายการแล้ว')
  }

  // Group items by year+month for timeline display
  const grouped = items.reduce<{ key: string; label: string; rows: ChangelogItem[] }[]>((acc, item) => {
    const d = new Date(item.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    const existing = acc.find(g => g.key === key)
    if (existing) existing.rows.push(item)
    else acc.push({ key, label, rows: [item] })
    return acc
  }, [])

  const totalShown = items.length

  return (
    <div style={{ padding: '0 0 48px' }}>
      <style>{`
        @keyframes clFadeUp { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes toastIn  { from { opacity: 0; transform: translateX(12px) } to { opacity: 1; transform: translateX(0) } }
        .cl-row { transition: background .1s; }
        .cl-row:hover { background: var(--surface-2) !important; }
        .cl-filter-select { padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 13px; font-family: inherit; color: var(--ink); background: var(--card); cursor: pointer; outline: none; }
        .cl-filter-select:focus { border-color: var(--primary); }
      `}</style>

      <PageHeader
        title="บันทึกการแก้ไขระบบ"
        eyebrow={`${totalShown} รายการ`}
        marginBottom={20}
        actions={canEdit ? (
          <Button variant="primary" icon="plus" onClick={() => setAddModal(true)}>เพิ่มรายการ</Button>
        ) : undefined}
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, alignItems: 'center' }}>
        <Icon name="filter" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <div style={{ flex: '1 1 220px', minWidth: 180 }}>
          <Input value={search} onChange={setSearch} placeholder="ค้นหาหัวข้อ, รายละเอียด, ผู้ดำเนินการ..." />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="cl-filter-select" style={{ minWidth: 160 }}>
          <option value="">ทุกหมวดหมู่</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Timeline list */}
      {loading && (
        <Card padding={0}>
          <div style={{ padding: 20 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ width: 80,  height: 13, borderRadius: 4, background: 'var(--surface-2)' }} />
                <div style={{ width: 70,  height: 20, borderRadius: 20, background: 'var(--surface-2)' }} />
                <div style={{ flex: 1,    height: 13, borderRadius: 4, background: 'var(--surface-2)' }} />
                <div style={{ width: 100, height: 13, borderRadius: 4, background: 'var(--surface-2)' }} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && items.length === 0 && (
        <Card padding={24}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Icon name="edit" size={26} style={{ color: 'var(--muted)' }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>ยังไม่มีรายการแก้ไข</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {canEdit ? 'กดปุ่ม "เพิ่มรายการ" เพื่อบันทึกการแก้ไขครั้งแรก' : 'ยังไม่มีข้อมูล'}
            </div>
          </div>
        </Card>
      )}

      {!loading && grouped.map(({ key, label, rows }) => (
        <div key={key} style={{ marginBottom: 24, animation: 'clFadeUp .2s ease both' }}>
          {/* Month header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: .8, whiteSpace: 'nowrap' }}>
              {label}
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{rows.length} รายการ</div>
          </div>

          <Card padding={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                  {['วันที่', 'หมวดหมู่', 'หัวข้อ / รายละเอียด', 'ผู้ดำเนินการ', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', letterSpacing: .6, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(item => (
                  <tr
                    key={item.id}
                    className="cl-row"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    {/* Date */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{formatDate(item.date)}</div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <Badge color={CATEGORY_BADGE[item.category] ?? 'gray'}>{item.category}</Badge>
                    </td>

                    {/* Title + description */}
                    <td style={{ padding: '12px 14px', minWidth: 240, verticalAlign: 'top' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{item.title}</div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.description}</div>
                      )}
                    </td>

                    {/* Changed by */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)' }}>
                            {item.changed_by.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{item.changed_by}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setEditItem(item)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                            <Icon name="edit" size={13} />
                          </button>
                          <button onClick={() => setDeleteItem(item)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ))}

      {/* Modals */}
      {(addModal || editItem) && (
        <ChangelogModal
          item={editItem ?? null}
          currentUserName={currentUserName}
          onClose={() => { setAddModal(false); setEditItem(null) }}
          onSaved={handleSaved}
        />
      )}
      {deleteItem && (
        <DeleteConfirm item={deleteItem} onClose={() => setDeleteItem(null)} onDeleted={handleDeleted} />
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
        {toasts.map(t => (
          <div key={t.id} className="cl-toast" style={{ padding: '12px 18px', borderRadius: 10, background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 6px 24px rgba(0,0,0,.22)', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, animation: 'toastIn .22s ease both' }}>
            <Icon name={t.ok ? 'check' : 'alert'} size={14} stroke={2.2} />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
