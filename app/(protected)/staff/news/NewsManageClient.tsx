'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterChips } from '@/components/ui/FilterChips'
import { CATEGORIES, CAT_MAP } from '@/lib/validations/news'
import { firstBodyImage } from '@/lib/line/news-flex'
import type { News } from '@/lib/supabase/types'

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

// ─── Constants ────────────────────────────────────────────────────────────────

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box',
}
const taStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', lineHeight: 1.5,
}

// ─── Color swatches ───────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  '#0F172A', '#DC2626', '#D97706', '#16A34A',
  '#1E5FAD', '#7C3AED', '#0891B2', '#DB2777',
  '#64748B', '#CA8A04', '#92400E', '#FFFFFF',
]

// ─── Formatting toolbar helpers ───────────────────────────────────────────────

interface ToolBtnProps { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }
function ToolBtn({ title, onClick, children, disabled, active }: ToolBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      data-active={active ? 'true' : undefined}
      style={{
        width: 26, height: 24, borderRadius: 5, flexShrink: 0, transition: 'all .1s',
        border: `1px solid ${active ? 'var(--primary)' : 'transparent'}`,
        background: active ? 'var(--primary-soft)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'inherit',
      }}
      onMouseDown={e => e.preventDefault()}
      onMouseEnter={e => {
        if (disabled) return
        if (e.currentTarget.dataset.active !== 'true') {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.background = 'var(--card)'
          e.currentTarget.style.color = 'var(--ink)'
        }
      }}
      onMouseLeave={e => {
        if (e.currentTarget.dataset.active === 'true') {
          e.currentTarget.style.borderColor = 'var(--primary)'
          e.currentTarget.style.background = 'var(--primary-soft)'
          e.currentTarget.style.color = 'var(--primary)'
        } else {
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--muted)'
        }
      }}
    >{children}</button>
  )
}
function AlignLeftIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
      <rect y="0" width="12" height="1.5" rx=".75"/><rect y="3" width="8" height="1.5" rx=".75"/>
      <rect y="6" width="12" height="1.5" rx=".75"/><rect y="9" width="6" height="1.5" rx=".75"/>
    </svg>
  )
}
function AlignCenterIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
      <rect y="0" width="12" height="1.5" rx=".75"/><rect x="2" y="3" width="8" height="1.5" rx=".75"/>
      <rect y="6" width="12" height="1.5" rx=".75"/><rect x="3" y="9" width="6" height="1.5" rx=".75"/>
    </svg>
  )
}
function AlignRightIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
      <rect y="0" width="12" height="1.5" rx=".75"/><rect x="4" y="3" width="8" height="1.5" rx=".75"/>
      <rect y="6" width="12" height="1.5" rx=".75"/><rect x="6" y="9" width="6" height="1.5" rx=".75"/>
    </svg>
  )
}

// ─── NewsFormModal ─────────────────────────────────────────────────────────────

interface ModalProps {
  item: News | null
  onClose: () => void
  onSaved: (n: News) => void
  toast: (msg: string, ok?: boolean) => void
}

function NewsFormModal({ item, onClose, onSaved, toast }: ModalProps) {
  const isEdit = item !== null
  const [form, setForm] = useState({
    title:      item?.title ?? '',
    excerpt:    item?.excerpt ?? '',
    body:       item?.body ?? '',
    cat:        item?.cat ?? 'announce',
    author:     item?.author ?? '',
    published:  item?.published ?? false,
    is_new:     item?.is_new ?? false,
    new_until:  item?.new_until ?? '',
    created_at: item?.created_at
      ? item.created_at.split('T')[0]
      : new Date().toISOString().split('T')[0],
  })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfDragOver, setPdfDragOver] = useState(false)
  const [removePdf, setRemovePdf] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [fSize, setFSize] = useState('')
  const [error, setError] = useState('')
  const pdfRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const savedSel = useRef<Range | null>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const [selectedColor, setSelectedColor] = useState('#0F172A')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [fmtState, setFmtState] = useState({ bold: false, italic: false, underline: false })
  const [imgPopover, setImgPopover] = useState<{ top: number; left: number; img: HTMLImageElement } | null>(null)

  function syncBody() {
    if (bodyRef.current) set('body', bodyRef.current.innerHTML)
  }

  function execFmt(cmd: string, value?: string) {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, value ?? undefined)
    syncBody()
  }

  function applyColor(c: string) {
    setSelectedColor(c)
    const sel = window.getSelection()
    if (savedSel.current && sel) { sel.removeAllRanges(); sel.addRange(savedSel.current) }
    bodyRef.current?.focus()
    document.execCommand('foreColor', false, c)
    syncBody()
    setShowColorPicker(false)
  }

  useEffect(() => {
    if (!showColorPicker) return
    function onDown(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node))
        setShowColorPicker(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showColorPicker])

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) { setError('รองรับเฉพาะไฟล์รูปภาพ'); return }
    if (file.size > 5 * 1024 * 1024) { setError('ขนาดรูปภาพเกิน 5 MB'); return }
    setImageUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/admin/news/upload-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'อัปโหลดรูปไม่สำเร็จ'); return }
      bodyRef.current?.focus()
      document.execCommand('insertHTML', false, `<img src="${json.url}" alt="" style="max-width:100%;border-radius:8px;margin:8px 0" />`)
      syncBody()
    } catch {
      setError('อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setImageUploading(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setError('')
  }

  function handleLink() {
    const selectedText = window.getSelection()?.toString() ?? ''
    const url = window.prompt('กรอก URL ลิ้งค์:', 'https://')
    if (!url) return
    bodyRef.current?.focus()
    if (selectedText) {
      document.execCommand('createLink', false, url)
      bodyRef.current?.querySelectorAll(`a[href="${url}"]`).forEach(a => {
        a.setAttribute('target', '_blank')
        a.setAttribute('rel', 'noopener noreferrer')
      })
    } else {
      document.execCommand('insertHTML', false,
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
    }
    syncBody()
  }

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = item?.body ?? ''
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onSel() {
      if (!bodyRef.current) return
      const sel = window.getSelection()
      if (!sel?.anchorNode || !bodyRef.current.contains(sel.anchorNode)) return
      setFmtState({
        bold:      document.queryCommandState('bold'),
        italic:    document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cat = CAT_MAP[form.cat as keyof typeof CAT_MAP] ?? CATEGORIES[0]

  async function handleSave() {
    if (!form.title.trim()) { setError('กรุณากรอกหัวข้อข่าว'); return }
    if (!form.cat)           { setError('กรุณาเลือกหมวดหมู่'); return }
    setSaving(true); setError('')

    const meta = {
      ...form,
      new_until:  form.new_until || null,
      removePdf:  removePdf && !pdfFile,
    }

    const fd = new FormData()
    fd.append('meta', JSON.stringify(meta))
    if (pdfFile) fd.append('pdf', pdfFile)

    const url    = isEdit ? `/api/admin/news/${item.id}` : '/api/admin/news'
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, { method, body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'เกิดข้อผิดพลาด'); return }
      toast(isEdit ? 'อัปเดตข่าวสารแล้ว' : 'สร้างข่าวสารแล้ว')
      onSaved(json as News)
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 580,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        {/* Modal header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>
            {isEdit ? 'แก้ไขข่าวสาร' : 'สร้างข่าวใหม่'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Live preview */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {form.is_new && (
              <span className="news-new-badge" style={{ background: '#DC2626', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '.06em' }}>NEW</span>
            )}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600,
              padding: '2px 8px', borderRadius: 4,
              background: cat.color + '18', color: cat.color,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.color }} />
              {cat.th}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{form.created_at ? fmtDate(form.created_at + 'T00:00:00') : ''}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: form.title ? 'var(--ink)' : 'var(--muted)', marginBottom: 4, lineHeight: 1.3 }}>
            {form.title || '— หัวข้อข่าว —'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
            {form.excerpt || '— คำโปรย —'}
          </div>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>หัวข้อข่าว <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              style={inputStyle}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="เช่น เปิดให้บริการตรวจ Vitamin D ตั้งแต่ 1 มิ.ย. 2569"
            />
          </div>

          {/* Category + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>หมวดหมู่ <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                value={form.cat}
                onChange={e => set('cat', e.target.value)}
                style={{ ...inputStyle, padding: '9px 10px' }}
              >
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.th}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>วันที่ <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="date"
                style={inputStyle}
                value={form.created_at}
                onChange={e => set('created_at', e.target.value)}
              />
            </div>
          </div>

          {/* Author */}
          <div>
            <label style={labelStyle}>ผู้เขียน</label>
            <input
              style={inputStyle}
              value={form.author}
              onChange={e => set('author', e.target.value)}
              placeholder="นาย..."
            />
          </div>

          {/* Excerpt */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>คำโปรย (Excerpt) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{form.excerpt.length}/500</span>
            </div>
            <textarea
              style={{ ...taStyle, minHeight: 70 }}
              rows={3}
              value={form.excerpt}
              onChange={e => set('excerpt', e.target.value)}
              placeholder="1–2 บรรทัด ใช้แสดงในหน้าแรก"
              maxLength={500}
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ ...labelStyle, marginBottom: 6 }}>เนื้อหา (เต็ม)</label>

            {/* Formatting toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
              padding: '4px 8px', border: '1px solid var(--border)', borderBottom: 'none',
              borderRadius: '8px 8px 0 0', background: 'var(--surface-2)',
              position: 'sticky', top: 0, zIndex: 5,
              boxShadow: '0 2px 6px rgba(0,0,0,.06)',
            }}>
              <ToolBtn title="ตัวหนา" onClick={() => execFmt('bold')} active={fmtState.bold}>
                <span style={{ fontWeight: 900, fontSize: 13 }}>B</span>
              </ToolBtn>
              <ToolBtn title="ตัวเอียง" onClick={() => execFmt('italic')} active={fmtState.italic}>
                <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 13 }}>I</span>
              </ToolBtn>
              <ToolBtn title="ขีดเส้นใต้" onClick={() => execFmt('underline')} active={fmtState.underline}>
                <span style={{ textDecoration: 'underline', fontSize: 13 }}>U</span>
              </ToolBtn>

              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

              {/* Font size — save selection on focus, restore on change */}
              <select
                value={fSize}
                onFocus={() => {
                  const sel = window.getSelection()
                  savedSel.current = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null
                }}
                onChange={e => {
                  const v = e.target.value
                  if (!v) return
                  setFSize('')
                  const sizeMap: Record<string, string> = { '2':'13px','3':'16px','4':'18px','5':'24px' }
                  const px = sizeMap[v] ?? '16px'
                  // Restore selection before applying (focus moved to select)
                  const sel = window.getSelection()
                  if (savedSel.current && sel) { sel.removeAllRanges(); sel.addRange(savedSel.current) }
                  bodyRef.current?.focus()
                  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
                  // Use Range API directly — preserves existing color/bold/etc.
                  const range = sel.getRangeAt(0)
                  const span = document.createElement('span')
                  span.style.fontSize = px
                  try { range.surroundContents(span) }
                  catch { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span) }
                  syncBody()
                }}
                style={{
                  height: 24, padding: '0 4px', borderRadius: 5,
                  border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit',
                  color: 'var(--muted)', background: 'var(--surface-2)',
                  cursor: 'pointer', outline: 'none', appearance: 'none' as const,
                }}
              >
                <option value="">ขนาด</option>
                <option value="2">เล็ก</option>
                <option value="3">ปกติ</option>
                <option value="4">ใหญ่</option>
                <option value="5">ใหญ่มาก</option>
              </select>

              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

              {/* Color picker */}
              <div ref={colorPickerRef} style={{ position: 'relative' }}>
                <ToolBtn
                  title="สีตัวอักษร"
                  active={showColorPicker}
                  onClick={() => {
                    const sel = window.getSelection()
                    savedSel.current = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null
                    setShowColorPicker(v => !v)
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: selectedColor === '#FFFFFF' ? 'var(--ink)' : selectedColor, lineHeight: 1 }}>A</span>
                    <span style={{ width: 14, height: 3, borderRadius: 1, background: selectedColor, display: 'block', boxShadow: selectedColor === '#FFFFFF' ? 'inset 0 0 0 1px #CBD5E1' : 'none' }} />
                  </div>
                </ToolBtn>

                {showColorPicker && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,.15)',
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', marginBottom: 7 }}>สีตัวอักษร</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 22px)', gap: 5 }}>
                      {COLOR_SWATCHES.map(c => (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          onMouseDown={e => { e.preventDefault(); applyColor(c) }}
                          style={{
                            width: 22, height: 22, borderRadius: 5, padding: 0,
                            border: c === selectedColor ? '2px solid var(--primary)' : '2px solid transparent',
                            background: c,
                            cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
                            boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #CBD5E1' : '0 1px 3px rgba(0,0,0,.2)',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>กำหนดเอง</span>
                      <input
                        type="color"
                        value={selectedColor === '#FFFFFF' ? '#ffffff' : selectedColor}
                        onChange={e => applyColor(e.target.value)}
                        style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', padding: 1, cursor: 'pointer', background: 'none' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

              <ToolBtn title="ชิดซ้าย" onClick={() => execFmt('justifyLeft')}>
                <AlignLeftIcon />
              </ToolBtn>
              <ToolBtn title="กึ่งกลาง" onClick={() => execFmt('justifyCenter')}>
                <AlignCenterIcon />
              </ToolBtn>
              <ToolBtn title="ชิดขวา" onClick={() => execFmt('justifyRight')}>
                <AlignRightIcon />
              </ToolBtn>

              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

              <ToolBtn title="ทำลิ้งค์" onClick={handleLink}>
                <Icon name="globe" size={12} />
              </ToolBtn>

              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

              <button
                type="button"
                title="แทรกรูปภาพ"
                onMouseDown={e => e.preventDefault()}
                onClick={() => imageRef.current?.click()}
                disabled={imageUploading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, height: 24,
                  padding: '0 8px', borderRadius: 5, border: '1px solid transparent',
                  background: 'transparent', fontSize: 11, fontWeight: 600,
                  color: imageUploading ? 'var(--muted)' : 'var(--ink)',
                  cursor: imageUploading ? 'default' : 'pointer', fontFamily: 'inherit',
                  transition: 'all .1s', flexShrink: 0,
                }}
                onMouseEnter={e => { if (!imageUploading) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
              >
                <Icon name="upload" size={11} />
                {imageUploading ? 'กำลังอัปโหลด...' : 'รูปภาพ'}
              </button>
            </div>

            {/* WYSIWYG contenteditable */}
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncBody}
              onClick={e => {
                const t = e.target as HTMLElement
                if (t.tagName === 'IMG') {
                  const rect = t.getBoundingClientRect()
                  setImgPopover({ top: rect.bottom + 6, left: rect.left, img: t as HTMLImageElement })
                } else {
                  setImgPopover(null)
                }
              }}
              data-placeholder="พิมพ์เนื้อหาข่าวที่นี่..."
              style={{
                minHeight: 120, padding: '9px 12px', borderRadius: '0 0 8px 8px',
                border: '1px solid var(--border)', borderTop: 'none',
                fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
                background: 'var(--card)', outline: 'none', lineHeight: 1.7,
                overflowY: 'auto', cursor: 'text', boxSizing: 'border-box',
              }}
            />

            {/* Image resize popover */}
            {imgPopover && (
              <div
                style={{
                  position: 'fixed', top: imgPopover.top, left: imgPopover.left,
                  zIndex: 1100, background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '5px 8px',
                  display: 'flex', alignItems: 'center', gap: 4,
                  boxShadow: '0 4px 16px rgba(0,0,0,.18)',
                }}
              >
                <span style={{ fontSize: 10.5, color: 'var(--muted)', marginRight: 2, whiteSpace: 'nowrap' }}>ขนาดรูป:</span>
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      imgPopover.img.style.width = `${pct}%`
                      imgPopover.img.style.maxWidth = '100%'
                      imgPopover.img.style.height = 'auto'
                      syncBody()
                    }}
                    style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: 11.5, fontWeight: 600,
                      border: '1px solid var(--border)', background: 'var(--surface-2)',
                      cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                    }}
                  >
                    {pct}%
                  </button>
                ))}
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setImgPopover(null)}
                  style={{
                    width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 0,
                    color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13,
                  }}
                >
                  <Icon name="x" size={11} />
                </button>
              </div>
            )}
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
            />
          </div>

          {/* PDF upload */}
          <div>
            <label style={labelStyle}>เอกสารแนบ (PDF)</label>

            {/* Show existing PDF in edit mode */}
            {isEdit && item.pdf_path && !removePdf && !pdfFile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)',
                marginBottom: 8,
              }}>
                <Icon name="doc" size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.pdf_path.split('/').pop()}
                </span>
                <button
                  onClick={() => setRemovePdf(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 11.5, padding: 0, fontFamily: 'inherit' }}
                >
                  ลบไฟล์แนบ
                </button>
              </div>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setPdfDragOver(true) }}
              onDragLeave={() => setPdfDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setPdfDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f?.type === 'application/pdf') setPdfFile(f)
              }}
              onClick={() => pdfRef.current?.click()}
              style={{
                border: `2px dashed ${pdfDragOver ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6,
                cursor: 'pointer', transition: 'all .15s',
                backgroundColor: pdfDragOver ? 'var(--primary-soft)' : 'var(--surface-2)',
              }}
            >
              {pdfFile ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="doc" size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{pdfFile.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setPdfFile(null); if (pdfRef.current) pdfRef.current.value = '' }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, lineHeight: 1 }}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <Icon name="upload" size={18} style={{ color: 'var(--muted)' }} />
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>ลากไฟล์ PDF มาวาง หรือ</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                    background: 'var(--primary)', color: '#fff',
                    pointerEvents: 'none',
                  }}>
                    <Icon name="download" size={12} />
                    เลือกไฟล์ PDF
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>รองรับเฉพาะ .pdf · สูงสุด 20 MB</span>
                </>
              )}
            </div>
            <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setPdfFile(f); setRemovePdf(false) } }} />
          </div>

          {/* NEW badge + publish */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_new}
                  onChange={e => set('is_new', e.target.checked)}
                  style={{ accentColor: '#DC2626', width: 15, height: 15, marginTop: 1, flexShrink: 0 }}
                />
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ background: '#DC2626', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '.06em' }}>NEW</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>ติดป้าย NEW</span>
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>ยกเลิกป้ายอัตโนมัติ</div>
                </div>
              </label>
              {form.is_new && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, display: 'block' }}>หมดอายุวันที่</label>
                  <input
                    type="date"
                    value={form.new_until}
                    onChange={e => set('new_until', e.target.value)}
                    style={{ ...inputStyle, fontSize: 12 }}
                  />
                </div>
              )}
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${form.published ? 'rgba(22,163,74,.3)' : 'var(--border)'}`, background: form.published ? 'rgba(22,163,74,.06)' : 'var(--surface-2)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={e => set('published', e.target.checked)}
                  style={{ accentColor: 'var(--success)', width: 15, height: 15, marginTop: 1, flexShrink: 0 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: form.published ? 'var(--success)' : 'var(--ink)' }}>เผยแพร่ทันที</span>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>แสดงในหน้าเว็บ public หลังบันทึก</div>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} icon="check">
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้างข่าวใหม่'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── LineSendModal ─────────────────────────────────────────────────────────────

// LINE brand green — fixed external-brand color, not themed by the app
const LINE_GREEN = '#06C755'

function LineIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 5.64 2 10.13c0 2.6 1.5 4.91 3.83 6.4-.13.48-.72 2.62-.75 2.79 0 0-.01.12.06.17.08.05.17.02.17.02.23-.03 2.9-1.9 3.36-2.22.75.11 1.53.17 2.33.17 5.52 0 10-3.64 10-8.13S17.52 2 12 2z" />
    </svg>
  )
}

interface LineSendModalProps {
  item: News
  onClose: () => void
  onSent: (id: number, sentAt: string, sentBy: string | null) => void
  toast: (msg: string, ok?: boolean) => void
}

function LineSendModal({ item, onClose, onSent, toast }: LineSendModalProps) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const cat = CAT_MAP[item.cat as keyof typeof CAT_MAP]
  const catColor = cat?.color ?? '#1E5FAD'
  const catLabel = cat?.th ?? 'ข่าวสาร'
  const heroUrl = firstBodyImage(item.body)
  const longDate = new Date(item.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

  async function handleSend() {
    setSending(true); setError('')
    try {
      const res = await fetch(`/api/admin/news/${item.id}/line-broadcast`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'ส่งไม่สำเร็จ'); return }
      toast('ส่งข่าวเข้า LINE แล้ว')
      onSent(item.id, json.line_sent_at, json.line_sent_by)
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 420,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: LINE_GREEN, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <LineIcon size={14} />
            </span>
            ส่งข่าวผ่าน LINE Official
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Preview — mimics LINE chat rendering, colors are LINE's fixed appearance */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', background: '#8CABD9' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.85)', letterSpacing: '.05em', marginBottom: 8, textAlign: 'center' }}>
            ตัวอย่างการแสดงผลในแชท LINE
          </div>
          <div style={{ maxWidth: 300, margin: '0 auto', background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
            {/* Card header */}
            <div style={{ background: catColor, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>ข่าวสารห้องปฏิบัติการ</span>
                {item.is_new && (
                  <span style={{ background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 10px', borderRadius: 10, letterSpacing: '.06em' }}>NEW</span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{catLabel}</div>
            </div>
            {/* Hero image (first image in body) */}
            {heroUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroUrl} alt="" style={{ width: '100%', aspectRatio: '20/13', objectFit: 'cover', display: 'block' }} />
            )}
            {/* Card body */}
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.45 }}>{item.title}</div>
              {item.excerpt && (
                <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.55, marginTop: 8 }}>{item.excerpt}</div>
              )}
              <div style={{ height: 1, background: '#E5EAF0', margin: '12px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 11, color: '#64748B' }}>📅 {longDate}</div>
                {item.author && <div style={{ fontSize: 11, color: '#64748B' }}>✍️ {item.author}</div>}
              </div>
            </div>
            {/* Card footer buttons */}
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: catColor, color: '#fff', fontSize: 12.5, fontWeight: 600, textAlign: 'center', padding: '9px 0', borderRadius: 8 }}>
                อ่านรายละเอียด
              </div>
              {item.pdf_path && (
                <div style={{ background: '#F1F4F9', color: '#0F172A', fontSize: 12.5, fontWeight: 600, textAlign: 'center', padding: '9px 0', borderRadius: 8 }}>
                  เปิดเอกสารแนบ (PDF)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warnings + actions */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--warning)', display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
            <Icon name="alert" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>ข้อความจะถูกส่ง (Broadcast) ถึงผู้ติดตาม LINE Official ทุกคน และไม่สามารถเรียกคืนได้</span>
          </div>
          {item.line_sent_at && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              ข่าวนี้เคยส่งแล้วเมื่อ {fmtDate(item.line_sent_at)}{item.line_sent_by ? ` โดย ${item.line_sent_by}` : ''} — การกดส่งอีกครั้งจะเป็นการส่งซ้ำ
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={onClose} disabled={sending}>ยกเลิก</Button>
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                borderRadius: 8, border: 'none', background: LINE_GREEN, color: '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
              }}
            >
              <LineIcon size={14} />
              {sending ? 'กำลังส่ง...' : item.line_sent_at ? 'ส่งซ้ำอีกครั้ง' : 'ยืนยันส่งเข้า LINE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton Row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 120, flexShrink: 0 }}>
        <div style={{ height: 20, borderRadius: 4, background: 'var(--surface-2)', width: 80 }} />
        <div style={{ height: 12, borderRadius: 4, background: 'var(--surface-2)', width: 64 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 14, borderRadius: 4, background: 'var(--surface-2)', width: '60%' }} />
        <div style={{ height: 12, borderRadius: 4, background: 'var(--surface-2)', width: '80%' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)' }} />
        <div style={{ height: 12, borderRadius: 4, background: 'var(--surface-2)', width: 40 }} />
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props { canEdit: boolean; initialCreate?: boolean }

export function NewsManageClient({ canEdit, initialCreate = false }: Props) {
  const [allNews, setAllNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'new'>('all')
  const [modalOpen, setModalOpen] = useState(initialCreate && canEdit)
  const [editTarget, setEditTarget] = useState<News | null>(null)
  const [lineTarget, setLineTarget] = useState<News | null>(null)
  const { toasts, add: toast } = useToast()

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [search])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/news')
      const json = await res.json()
      setAllNews(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    let list = allNews
    if (catFilter) list = list.filter(n => n.cat === catFilter)
    if (q) list = list.filter(n =>
      n.title.toLowerCase().includes(q) || (n.excerpt ?? '').toLowerCase().includes(q))
    if (statusFilter === 'published') list = list.filter(n => n.published)
    if (statusFilter === 'draft')     list = list.filter(n => !n.published)
    if (statusFilter === 'new')       list = list.filter(n => n.is_new)
    return list
  }, [allNews, catFilter, debouncedSearch, statusFilter])

  const stats = useMemo(() => ({
    total:     allNews.length,
    published: allNews.filter(n => n.published).length,
    draft:     allNews.filter(n => !n.published).length,
    isNew:     allNews.filter(n => n.is_new).length,
  }), [allNews])

  async function handleTogglePublish(item: News) {
    const res = await fetch(`/api/admin/news/${item.id}/toggle-publish`, { method: 'PATCH' })
    if (res.ok) {
      const { published } = await res.json()
      setAllNews(prev => prev.map(n => n.id === item.id ? { ...n, published } : n))
      toast(published ? 'เผยแพร่ข่าวแล้ว' : 'ยกเลิกการเผยแพร่แล้ว')
    } else {
      const json = await res.json().catch(() => ({}))
      toast(json.error ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่', false)
    }
  }

  async function handleDelete(item: News) {
    if (!confirm(`ยืนยันการลบ "${item.title}"?\nการลบไม่สามารถกู้คืนได้`)) return
    const res = await fetch(`/api/admin/news/${item.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setAllNews(prev => prev.filter(n => n.id !== item.id))
      toast('ลบข่าวสารแล้ว')
    } else {
      toast('ลบไม่สำเร็จ', false)
    }
  }

  function handleLineSent(id: number, sentAt: string, sentBy: string | null) {
    setAllNews(prev => prev.map(n => n.id === id ? { ...n, line_sent_at: sentAt, line_sent_by: sentBy } : n))
    setLineTarget(null)
  }

  function handleSaved(saved: News) {
    setAllNews(prev => {
      const exists = prev.find(n => n.id === saved.id)
      return exists
        ? prev.map(n => n.id === saved.id ? saved : n)
        : [saved, ...prev]
    })
    setModalOpen(false)
    setEditTarget(null)
  }

  const TABS = [
    { key: 'all',       label: 'ทั้งหมด',   count: stats.total },
    { key: 'published', label: 'เผยแพร่',    count: stats.published },
    { key: 'draft',     label: 'ฉบับร่าง',   count: stats.draft },
    { key: 'new',       label: 'NEW',        count: stats.isNew },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes news-badge-ripple {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,.55), 0 0 0 0 rgba(220,38,38,.25); }
          70%  { box-shadow: 0 0 0 8px rgba(220,38,38,0), 0 0 0 16px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0),  0 0 0 0  rgba(220,38,38,0); }
        }
        .news-new-badge { animation: news-badge-ripple 1.4s ease-out infinite; display: inline-flex; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {stats.total} ข่าว · เผยแพร่ {stats.published}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>
            จัดการข่าวสารห้องปฏิบัติการ
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
            สร้าง แก้ไข และตั้งป้าย NEW สำหรับข่าวที่แสดงในหน้าเว็บ public
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button variant="secondary" icon="download">ส่งออก</Button>
            <Button variant="primary" icon="plus" onClick={() => { setEditTarget(null); setModalOpen(true) }}>
              สร้างข่าวใหม่
            </Button>
          </div>
        )}
      </div>

      {/* Stats row — icon top-right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'ข่าวทั้งหมด', value: stats.total,     icon: 'bell',  color: 'var(--primary)', bg: 'var(--primary-soft)' },
          { label: 'เผยแพร่แล้ว', value: stats.published, icon: 'globe', color: 'var(--success)', bg: 'rgba(22,163,74,.1)' },
          { label: 'ฉบับร่าง',    value: stats.draft,     icon: 'edit',  color: 'var(--warning)', bg: 'rgba(217,119,6,.1)' },
          { label: 'ติดป้าย NEW', value: stats.isNew,     icon: 'alert', color: 'var(--danger)',  bg: 'rgba(220,38,38,.1)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 18px', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 14, right: 14,
              width: 34, height: 34, borderRadius: 8, backgroundColor: s.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={s.icon as any} size={16} style={{ color: s.color }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{
            height: 38, padding: '0 28px 0 10px', borderRadius: 8,
            border: `1.5px solid ${catFilter ? 'var(--primary)' : 'var(--border)'}`,
            fontSize: 12.5, fontFamily: 'inherit',
            color: catFilter ? 'var(--primary)' : 'var(--muted)',
            backgroundColor: catFilter ? 'var(--primary-soft)' : 'var(--card)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            appearance: 'none', cursor: 'pointer', outline: 'none', fontWeight: catFilter ? 600 : 400,
          }}
        >
          <option value="">ทุกหมวด</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.th}</option>)}
        </select>

        <FilterChips
          label="กรองตามสถานะข่าว"
          value={statusFilter}
          onChange={setStatusFilter}
          compact
          items={TABS.map(tab => ({ value: tab.key, label: tab.label, count: tab.count }))}
        />

        <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          พบ <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{filtered.length}</span> รายการ
        </div>
      </div>

      {/* News list */}
      <Card padding={0}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : filtered.length === 0 ? (
          <EmptyState icon="bell" title="ไม่พบข่าวสาร" hint="ลองเปลี่ยนตัวกรองหรือสร้างข่าวใหม่" />
        ) : (
          filtered.map((n, idx) => {
            const cat = CAT_MAP[n.cat as keyof typeof CAT_MAP]
            const initial = (n.author ?? 'A').charAt(0).toUpperCase()
            const isLast = idx === filtered.length - 1
            const catColor = cat?.color ?? '#64748B'
            return (
              <div
                key={n.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Category icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: catColor + '18', border: `1px solid ${catColor}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="doc" size={16} style={{ color: catColor }} />
                </div>

                {/* Meta: badges + date */}
                <div style={{ width: 156, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {n.is_new && (
                      <span className="news-new-badge" style={{ background: '#DC2626', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '.06em' }}>NEW</span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                      background: catColor + '18', color: catColor, whiteSpace: 'nowrap',
                    }}>
                      {cat?.th ?? n.cat}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(n.created_at)}</span>
                  {n.line_sent_at && (
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#06C755', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <LineIcon size={10} /> ส่งแล้ว {fmtDate(n.line_sent_at)}
                    </span>
                  )}
                </div>

                {/* Content: title + excerpt + author + views */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                    {n.title}
                  </div>
                  {n.excerpt && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.excerpt}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <div title={n.author ?? ''} style={{
                      width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)',
                      color: '#fff', fontSize: 9.5, fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {initial}
                    </div>
                    {n.author && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{n.author}</span>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--muted)', fontSize: 11.5 }}>
                      <Icon name="eye" size={11} />
                      <span>{(n.views ?? 0).toLocaleString()} views</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  {/* Toggle publish — globe icon, green = published, gray = draft */}
                  {canEdit && (
                    <button
                      onClick={() => handleTogglePublish(n)}
                      title={n.published ? 'ยกเลิกการเผยแพร่' : 'เผยแพร่'}
                      style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${n.published ? 'rgba(22,163,74,.3)' : 'var(--border)'}`, background: n.published ? 'rgba(22,163,74,.06)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.background = 'rgba(22,163,74,.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = n.published ? 'rgba(22,163,74,.3)' : 'var(--border)'; e.currentTarget.style.background = n.published ? 'rgba(22,163,74,.06)' : 'transparent' }}
                    >
                      <Icon name="globe" size={13} style={{ color: n.published ? 'var(--success)' : 'var(--muted)' }} />
                    </button>
                  )}

                  {/* Send via LINE OA — manual broadcast, published news only */}
                  {canEdit && n.published && (
                    <button
                      onClick={() => setLineTarget(n)}
                      title={n.line_sent_at ? `ส่ง LINE แล้ว ${fmtDate(n.line_sent_at)} — กดเพื่อส่งซ้ำ` : 'ส่งข่าวผ่าน LINE Official'}
                      style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${n.line_sent_at ? 'rgba(6,199,85,.35)' : 'var(--border)'}`, background: n.line_sent_at ? 'rgba(6,199,85,.08)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#06C755'; e.currentTarget.style.background = 'rgba(6,199,85,.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = n.line_sent_at ? 'rgba(6,199,85,.35)' : 'var(--border)'; e.currentTarget.style.background = n.line_sent_at ? 'rgba(6,199,85,.08)' : 'transparent' }}
                    >
                      <span style={{ color: n.line_sent_at ? '#06C755' : 'var(--muted)', display: 'flex' }}>
                        <LineIcon size={14} />
                      </span>
                    </button>
                  )}

                  {/* Preview */}
                  <button
                    onClick={() => window.open(`/news/${n.id}`, '_blank')}
                    title="ดูหน้า public"
                    style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-soft)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon name="eye" size={13} style={{ color: 'var(--muted)' }} />
                  </button>

                  {/* Edit */}
                  {canEdit && (
                    <button
                      onClick={() => { setEditTarget(n); setModalOpen(true) }}
                      title="แก้ไข"
                      style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-soft)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon name="edit" size={13} style={{ color: 'var(--muted)' }} />
                    </button>
                  )}

                  {/* Delete */}
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(n)}
                      title="ลบ"
                      style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.background = 'rgba(220,38,38,.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon name="trash" size={13} style={{ color: 'var(--muted)' }} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </Card>

      {/* Toast stack */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: t.ok ? '#166534' : '#B91C1C', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxWidth: 320 }}>
            {t.ok ? '✓ ' : '✕ '}{t.msg}
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <NewsFormModal
          item={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null) }}
          onSaved={handleSaved}
          toast={toast}
        />
      )}

      {/* LINE send modal */}
      {lineTarget && (
        <LineSendModal
          item={lineTarget}
          onClose={() => setLineTarget(null)}
          onSent={handleLineSent}
          toast={toast}
        />
      )}
    </div>
  )
}
