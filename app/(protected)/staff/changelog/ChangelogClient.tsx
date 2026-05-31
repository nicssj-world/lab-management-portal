'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
  changed_by_avatar: string | null
  created_at: string
  updated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['เครื่องมือ', 'เอกสาร', 'ระบบ / Portal', 'ฐานข้อมูล', 'สิทธิ์ผู้ใช้', 'รายการตรวจ', 'อื่นๆ']

const CATEGORY_COLOR: Record<string, string> = {
  'เครื่องมือ':    '#2563EB',
  'เอกสาร':        '#0891B2',
  'ระบบ / Portal': '#7C3AED',
  'ฐานข้อมูล':     '#D97706',
  'สิทธิ์ผู้ใช้':  '#DC2626',
  'รายการตรวจ':    '#059669',
  'อื่นๆ':         '#6B7280',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitDate(d: string) {
  try {
    const date = new Date(d)
    return {
      day:   date.toLocaleDateString('th-TH', { day: '2-digit' }),
      month: date.toLocaleDateString('th-TH', { month: 'short' }),
    }
  } catch { return { day: '--', month: '---' } }
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase()
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

// ─── Shared form styles ────────────────────────────────────────────────────────

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
  item, currentUserName, onClose, onSaved,
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

  const accent = CATEGORY_COLOR[form.category ?? 'อื่นๆ'] ?? '#6B7280'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', borderTop: `3px solid ${accent}` }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการแก้ไข'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', borderRadius: 6 }}>
            <Icon name="x" size={17} />
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 24px' }} />

        {/* Body */}
        <div style={{ padding: 24, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && (
            <div style={{ padding: '9px 13px', borderRadius: 8, background: 'rgba(220,38,38,.07)', color: '#B91C1C', fontSize: 12.5, border: '1px solid rgba(220,38,38,.18)' }}>
              {err}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>วันที่ *</label>
              <input type="date" style={inputStyle} value={form.date ?? today()} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>หมวดหมู่ *</label>
              <select
                style={{ ...inputStyle, borderLeftColor: accent, borderLeftWidth: 3 }}
                value={form.category ?? 'อื่นๆ'}
                onChange={e => set('category', e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>หัวข้อ *</label>
            <input style={inputStyle} value={form.title ?? ''} onChange={e => set('title', e.target.value)}
              placeholder="เช่น เพิ่มเครื่องมือใหม่ 3 เครื่อง, แก้ไข SOP เล่ม 5" />
          </div>

          <div>
            <label style={labelStyle}>รายละเอียด / หมายเหตุ</label>
            <textarea style={{ ...inputStyle, height: 90, resize: 'vertical', lineHeight: 1.55 }}
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value || null)}
              placeholder="อธิบายรายละเอียดของการแก้ไข..." />
          </div>

          <div>
            <label style={labelStyle}>ผู้ดำเนินการ *</label>
            <input style={inputStyle} value={form.changed_by ?? ''} onChange={e => set('changed_by', e.target.value)}
              placeholder="ชื่อผู้ที่ทำการแก้ไข" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 24px' }} />
        <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, opacity: saving ? 0.7 : 1, transition: 'opacity .15s' }}>
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 56px rgba(0,0,0,.2)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(220,38,38,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon name="trash" size={18} style={{ color: 'var(--danger)' }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>ลบรายการ</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            ต้องการลบ <span style={{ color: 'var(--ink)', fontWeight: 600 }}>"{item.title}"</span>?<br />
            ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้
          </div>
        </div>
        <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
          <button onClick={handleDelete} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
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
    <div style={{ padding: '0 0 56px' }}>
      <style>{`
        @keyframes clFadeUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes toastIn  { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes clPulse  { 0%,100% { opacity: .4 } 50% { opacity: 1 } }

        .cl-entry {
          display: flex; align-items: stretch;
          border-bottom: 1px solid var(--border);
          border-left: 3px solid transparent;
          transition: background .12s, border-left-color .12s;
          cursor: default;
        }
        .cl-entry:last-child { border-bottom: none; }
        .cl-entry:hover { background: var(--surface-2); }

        .cl-cell-date    { flex: 0 0 100px; padding: 14px 12px 14px 16px; display: flex; flex-direction: column; justify-content: flex-start; }
        .cl-cell-cat     { flex: 0 0 140px; padding: 14px 12px; display: flex; align-items: flex-start; }
        .cl-cell-content { flex: 1; min-width: 0; padding: 14px 12px; }
        .cl-cell-author  { flex: 0 0 170px; padding: 14px 12px; display: flex; align-items: center; }
        .cl-cell-actions { flex: 0 0 ${canEdit ? '72px' : '0px'}; padding: 14px 12px; display: flex; align-items: flex-start; justify-content: flex-end; gap: 5px; overflow: hidden; }

        .cl-action-btn {
          width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border);
          background: transparent; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: var(--muted); transition: all .12s; flex-shrink: 0;
        }
        .cl-action-btn:hover { background: var(--surface-2); border-color: var(--primary); color: var(--primary); }
        .cl-action-btn.danger:hover { border-color: var(--danger); color: var(--danger); background: rgba(220,38,38,.05); }

        .cl-filter-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border);
          background: transparent; cursor: pointer; font-size: 12.5px; font-family: inherit;
          color: var(--muted); transition: all .12s; white-space: nowrap;
        }
        .cl-filter-chip:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }
        .cl-filter-chip.active { background: var(--primary); border-color: var(--primary); color: #fff; }

        .cl-skeleton { animation: clPulse 1.4s ease infinite; }
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px', minWidth: 160 }}>
          <Input value={search} onChange={setSearch} placeholder="ค้นหาหัวข้อ, รายละเอียด, ผู้ดำเนินการ..." />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`cl-filter-chip${categoryFilter === '' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('')}
          >ทั้งหมด</button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`cl-filter-chip${categoryFilter === c ? ' active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
              style={categoryFilter === c ? {} : { borderLeftColor: CATEGORY_COLOR[c], borderLeftWidth: 2 }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="cl-skeleton" style={{ display: 'flex', gap: 0, borderBottom: i < 4 ? '1px solid var(--border)' : 'none', borderLeft: '3px solid var(--border)' }}>
              <div style={{ flex: '0 0 108px', padding: '14px' }}>
                <div style={{ height: 18, width: 32, borderRadius: 4, background: 'var(--surface-2)', marginBottom: 5 }} />
                <div style={{ height: 11, width: 28, borderRadius: 3, background: 'var(--surface-2)' }} />
              </div>
              <div style={{ flex: '0 0 138px', padding: '16px 12px' }}>
                <div style={{ height: 20, width: 80, borderRadius: 10, background: 'var(--surface-2)' }} />
              </div>
              <div style={{ flex: 1, padding: '16px 12px' }}>
                <div style={{ height: 13, width: '60%', borderRadius: 4, background: 'var(--surface-2)', marginBottom: 7 }} />
                <div style={{ height: 11, width: '40%', borderRadius: 3, background: 'var(--surface-2)' }} />
              </div>
              <div style={{ flex: '0 0 152px', padding: '16px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--surface-2)', flexShrink: 0 }} />
                <div style={{ height: 12, width: 80, borderRadius: 3, background: 'var(--surface-2)', marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Icon name="edit" size={24} style={{ color: 'var(--muted)' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>ยังไม่มีรายการแก้ไข</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {canEdit ? 'กดปุ่ม "เพิ่มรายการ" เพื่อบันทึกการแก้ไขครั้งแรก' : 'ยังไม่มีข้อมูล'}
          </div>
        </div>
      )}

      {/* Timeline groups */}
      {!loading && grouped.map(({ key, label, rows }, gi) => {
        const accent = CATEGORY_COLOR[rows[0]?.category] // not used for header but kept

        return (
          <div key={key} style={{ marginBottom: 28, animation: `clFadeUp .22s ease ${gi * .04}s both` }}>

            {/* Month header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', letterSpacing: .4, whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
              }}>
                {rows.length} รายการ
              </span>
            </div>

            {/* Entry card */}
            <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>

              {/* Column header row */}
              <div style={{ display: 'flex', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', borderLeft: '3px solid transparent' }}>
                <div className="cl-cell-date"    style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: .8, textTransform: 'uppercase', paddingTop: 9, paddingBottom: 9 }}>วันที่</div>
                <div className="cl-cell-cat"     style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: .8, textTransform: 'uppercase', paddingTop: 9, paddingBottom: 9, display: 'flex', alignItems: 'center' }}>หมวดหมู่</div>
                <div className="cl-cell-content" style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: .8, textTransform: 'uppercase', paddingTop: 9, paddingBottom: 9, display: 'flex', alignItems: 'center' }}>หัวข้อ / รายละเอียด</div>
                <div className="cl-cell-author"  style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: .8, textTransform: 'uppercase', paddingTop: 9, paddingBottom: 9, display: 'flex', alignItems: 'center' }}>ผู้ดำเนินการ</div>
                {canEdit && <div className="cl-cell-actions" style={{ paddingTop: 9, paddingBottom: 9 }} />}
              </div>

              {rows.map((item, ri) => {
                const color = CATEGORY_COLOR[item.category] ?? '#6B7280'
                const { day, month } = splitDate(item.date)

                return (
                  <div
                    key={item.id}
                    className="cl-entry"
                    style={{ borderLeftColor: color, animationDelay: `${(gi * 5 + ri) * .03}s` }}
                  >
                    {/* Date */}
                    <div className="cl-cell-date">
                      <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{day}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, fontWeight: 500 }}>{month}</span>
                    </div>

                    {/* Category */}
                    <div className="cl-cell-cat">
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                        background: color + '14', color,
                        border: `1px solid ${color}28`,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        {item.category}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="cl-cell-content">
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{item.title}</div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {item.description}
                        </div>
                      )}
                    </div>

                    {/* Author */}
                    <div className="cl-cell-author">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {item.changed_by_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.changed_by_avatar} alt={item.changed_by}
                            style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                            background: color + '18', border: `1px solid ${color}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800, color }}>{initials(item.changed_by)}</span>
                          </div>
                        )}
                        <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {item.changed_by}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="cl-cell-actions">
                        <button className="cl-action-btn" onClick={() => setEditItem(item)} title="แก้ไข">
                          <Icon name="edit" size={13} />
                        </button>
                        <button className="cl-action-btn danger" onClick={() => setDeleteItem(item)} title="ลบ">
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

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
          <div key={t.id} style={{ padding: '11px 16px', borderRadius: 10, background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 6px 24px rgba(0,0,0,.2)', minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, animation: 'toastIn .2s ease both' }}>
            <Icon name={t.ok ? 'check' : 'alert'} size={14} />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
