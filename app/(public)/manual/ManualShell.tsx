'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { sanitizeRichHtml } from '@/lib/html-sanitize'
import { MANUAL_SECTIONS, PHONE_DIRECTORY } from './data'
import { ManualHome } from './sections/ManualHome'
import { ManualCollection } from './sections/ManualCollection'
import { ManualTransport } from './sections/ManualTransport'
import { ManualAddon } from './sections/ManualAddon'
import { ManualReport } from './sections/ManualReport'
import { ManualOutLab } from './sections/ManualOutLab'
import { ManualMicrobiology } from './sections/ManualMicrobiology'
import { ManualBloodBank } from './sections/ManualBloodBank'
import { ManualAmendment } from './sections/ManualAmendment'

// ─── Editor helpers ─────────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  '#0F172A', '#DC2626', '#D97706', '#16A34A',
  '#1E5FAD', '#7C3AED', '#0891B2', '#DB2777',
  '#64748B', '#CA8A04', '#92400E', '#FFFFFF',
]

interface ToolBtnProps { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }
function ToolBtn({ title, onClick, children, disabled, active }: ToolBtnProps) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      data-active={active ? 'true' : undefined}
      onMouseDown={e => e.preventDefault()}
      style={{
        width: 26, height: 24, borderRadius: 5, flexShrink: 0, transition: 'all .1s',
        border: `1px solid ${active ? 'var(--primary)' : 'transparent'}`,
        background: active ? 'var(--primary-soft)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'inherit',
      }}
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
const AlignLeftIcon = () => <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor"><rect y="0" width="12" height="1.5" rx=".75"/><rect y="3" width="8" height="1.5" rx=".75"/><rect y="6" width="12" height="1.5" rx=".75"/><rect y="9" width="6" height="1.5" rx=".75"/></svg>
const AlignCenterIcon = () => <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor"><rect y="0" width="12" height="1.5" rx=".75"/><rect x="2" y="3" width="8" height="1.5" rx=".75"/><rect y="6" width="12" height="1.5" rx=".75"/><rect x="3" y="9" width="6" height="1.5" rx=".75"/></svg>
const AlignRightIcon = () => <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor"><rect y="0" width="12" height="1.5" rx=".75"/><rect x="4" y="3" width="8" height="1.5" rx=".75"/><rect y="6" width="12" height="1.5" rx=".75"/><rect x="6" y="9" width="6" height="1.5" rx=".75"/></svg>

// ─── Toast ───────────────────────────────────────────────────────────────────────

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

// Short labels for mobile nav — built from MANUAL_SECTIONS automatically
// th: ตัดเอาแค่คำแรก (ก่อนเว้นวรรค) เพื่อให้พอดีกับช่องเล็ก
function shortLabel(s: { th: string; en: string }) {
  return {
    th: s.th.replace(/การ/, '').split(/[·\s\/]/)[0].trim().slice(0, 6) || s.th.slice(0, 6),
    en: s.en.split(/[\s·\/]/)[0].trim().slice(0, 10),
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────────

interface Props {
  dbSections?: Record<string, { th: string; en: string }>
  canEdit?: boolean
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ManualShell({ dbSections = {}, canEdit = false }: Props) {
  const { lang } = useLang()
  const { toasts, add: toast } = useToast()

  const [activeSection, setActiveSection] = useState('home')
  const [localSections, setLocalSections] = useState(dbSections)
  const staticContentRef = useRef<HTMLDivElement>(null)

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [editLang, setEditLang] = useState<'th' | 'en'>('th')
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#0F172A')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [fSize, setFSize] = useState('')
  const [fmtState, setFmtState] = useState({ bold: false, italic: false, underline: false })

  const bodyRef = useRef<HTMLDivElement>(null)
  const savedSel = useRef<Range | null>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  function goSection(id: string) {
    if (editMode) {
      if (!window.confirm('ออกจากโหมดแก้ไข? การเปลี่ยนแปลงที่ยังไม่บันทึกจะหายไป')) return
      setEditMode(false)
    }
    setActiveSection(id)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Load current HTML into editor when entering edit mode or switching lang
  useEffect(() => {
    if (!editMode || !bodyRef.current) return
    const db = localSections[activeSection]
    bodyRef.current.innerHTML = sanitizeRichHtml(editLang === 'th' ? (db?.th ?? '') : (db?.en ?? ''))
  }, [editMode, editLang, activeSection]) // eslint-disable-line

  function syncBody() {
    if (!bodyRef.current) return
    const html = bodyRef.current.innerHTML
    setLocalSections(prev => {
      const cur = prev[activeSection] ?? { th: '', en: '' }
      return { ...prev, [activeSection]: editLang === 'th' ? { ...cur, th: html } : { ...cur, en: html } }
    })
  }

  function execFmt(cmd: string) {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, undefined)
    syncBody()
    setFmtState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    })
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

  function handleLink() {
    const sel = window.getSelection()
    savedSel.current = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null
    const url = window.prompt('URL ของลิ้งค์:')
    if (!url) return
    if (savedSel.current && sel) { sel.removeAllRanges(); sel.addRange(savedSel.current) }
    bodyRef.current?.focus()
    document.execCommand('createLink', false, url)
    syncBody()
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) { toast('รองรับเฉพาะไฟล์รูปภาพ', false); return }
    if (file.size > 5 * 1024 * 1024) { toast('ขนาดรูปภาพเกิน 5 MB', false); return }
    setImageUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/admin/news/upload-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'อัปโหลดรูปไม่สำเร็จ', false); return }
      bodyRef.current?.focus()
      document.execCommand('insertHTML', false, `<img src="${json.url}" style="max-width:100%;border-radius:6px;margin:6px 0;" />`)
      syncBody()
    } catch { toast('อัปโหลดรูปไม่สำเร็จ', false) }
    finally { setImageUploading(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const sec = localSections[activeSection] ?? { th: '', en: '' }
      const clean = {
        th: sanitizeRichHtml(sec.th),
        en: sanitizeRichHtml(sec.en),
      }
      const res = await fetch(`/api/admin/manual/${activeSection}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body_html_th: clean.th, body_html_en: clean.en }),
      })
      if (!res.ok) { toast((await res.json()).error ?? 'บันทึกไม่สำเร็จ', false); return }
      setLocalSections(prev => ({ ...prev, [activeSection]: clean }))
      if (bodyRef.current) bodyRef.current.innerHTML = editLang === 'th' ? clean.th : clean.en
      toast('บันทึกเรียบร้อยแล้ว')
      setEditMode(false)
    } catch { toast('เกิดข้อผิดพลาด', false) }
    finally { setSaving(false) }
  }

  const idx = MANUAL_SECTIONS.findIndex(s => s.id === activeSection)
  const prev = idx > 0 ? MANUAL_SECTIONS[idx - 1] : null
  const next = idx < MANUAL_SECTIONS.length - 1 ? MANUAL_SECTIONS[idx + 1] : null
  const activeLabel = MANUAL_SECTIONS[idx]
  const divider = <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

  // What to show in the content area
  const db = localSections[activeSection]
  const displayHtml = sanitizeRichHtml(lang === 'th' ? db?.th : db?.en)
  const hasCustomContent = !!(db?.th?.trim() || db?.en?.trim())

  return (
    <>
      <style>{`
        /* ── Editor ── */
        .manual-nav-btn { transition: background .15s, color .15s !important; }
        .manual-nav-btn:not(.manual-nav-active):hover { background: var(--primary-soft) !important; color: var(--primary) !important; }
        .manual-db-content h1,.manual-db-content h2,.manual-db-content h3 { font-weight: 700; color: var(--ink); margin: 1.2em 0 .4em; line-height: 1.3; }
        .manual-db-content h1 { font-size: 22px; } .manual-db-content h2 { font-size: 18px; } .manual-db-content h3 { font-size: 15px; }
        .manual-db-content p { margin: .6em 0; }
        .manual-db-content ul,.manual-db-content ol { padding-left: 1.4em; margin: .5em 0; }
        .manual-db-content li { margin: .25em 0; }
        .manual-db-content table { border-collapse: collapse; width: 100%; margin: .8em 0; font-size: 13px; }
        .manual-db-content th,.manual-db-content td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; }
        .manual-db-content th { background: var(--surface-2); font-weight: 700; color: var(--muted); }
        .manual-db-content a { color: var(--primary); } .manual-db-content img { max-width: 100%; border-radius: 8px; margin: 6px 0; }
        .manual-db-content strong { font-weight: 700; }
        .manual-editor [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--muted); pointer-events: none; }
        .manual-editor img { max-width: 100%; border-radius: 6px; }
        .manual-editor a { color: var(--primary); }

        /* ── Layout ── */
        .manual-header-wrap  { background: var(--card); border-bottom: 1px solid var(--border); box-shadow: 0 1px 0 var(--border); }
        .manual-header-inner { max-width: 1280px; margin: 0 auto; padding: 24px 32px 22px; }
        .manual-title        { font-size: 28px; font-weight: 800; color: var(--ink); letter-spacing: -.025em; margin: 0; line-height: 1.15; }
        .manual-layout       { max-width: 1280px; margin: 0 auto; padding: 28px 32px 64px; display: grid; grid-template-columns: 250px 1fr; gap: 32px; align-items: start; }
        .manual-sidebar      { position: sticky; top: 80px; }

        /* Sidebar nav */
        .manual-sidebar-nav  { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
        .manual-sidebar-nav-header { font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; padding: 8px 10px 4px; }
        .manual-nav-btn {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 12px; border-radius: 8px; border: none;
          background: transparent; color: var(--ink);
          font-weight: 500; font-size: 13px; line-height: 1.35;
          cursor: pointer; font-family: inherit; text-align: left; width: 100%;
          transition: background .15s, color .15s, transform .15s !important;
        }
        .manual-nav-btn:hover { background: var(--primary-soft) !important; color: var(--ink) !important; transform: translateX(3px); }
        .manual-nav-active { background: var(--primary-soft) !important; color: var(--primary) !important; font-weight: 600 !important; }

        /* Phone directory */
        .manual-phone-dir    { margin-top: 10px; padding: 14px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; font-size: 12px; color: var(--muted); line-height: 1.55; }

        /* Head-of-department contact QR */
        .manual-qr-box       { margin-top: 10px; padding: 14px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; }
        .manual-qr-box img   { width: 100%; max-width: 180px; aspect-ratio: 1 / 1; object-fit: contain; border-radius: 8px; background: #fff; border: 1px solid var(--border); padding: 8px; }

        .manual-content      { min-width: 0; }
        .manual-prevnext     { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
        .manual-mobile-topbar { display: none; }

        /* ── Prev/Next buttons ── */
        .manual-prevnext-btn {
          display: flex; align-items: center; gap: 12; padding: 14px 18px;
          border: 1px solid var(--border); border-radius: 10;
          background: var(--card); cursor: pointer; font-family: inherit;
          transition: border-color .15s, box-shadow .15s;
        }
        .manual-prevnext-btn:hover { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .manual-header-inner { padding: 16px 16px 14px; }
          .manual-title        { font-size: 19px; }
          .manual-header-subtitle { font-size: 12.5px !important; }
          .manual-layout       { grid-template-columns: 1fr; padding: 0 0 48px; gap: 0; }
          .manual-sidebar      { display: none; }
          .manual-mobile-topbar { display: block; background: var(--card); border-bottom: 1px solid var(--border); }
          .manual-mobile-section-bar { display: flex; align-items: center; gap: 10px; padding: 11px 16px; border-bottom: 1px solid var(--border); }
          .manual-mobile-section-name { font-size: 13px; font-weight: 700; color: var(--primary); flex: 1; }
          .manual-mobile-nav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 1px; background: var(--border); }
          .manual-mobile-nav-item { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 11px 8px 9px; border: none; cursor: pointer; font-family: inherit; transition: background .12s; }
          .manual-mobile-nav-item:hover { background: var(--surface-2); }
          .manual-mobile-nav-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
          .manual-mobile-nav-label { font-size: 10.5px; font-weight: 600; line-height: 1.25; text-align: center; }
          .manual-content  { padding: 18px 16px; }
          .manual-prevnext { gap: 8px; }
          .manual-prevnext-title { font-size: 12px !important; }
        }
      `}</style>

      {/* Page header */}
      <div className="manual-header-wrap">
        {/* Top accent bar */}
        <div style={{ height: 3, background: 'var(--primary)' }} />
        <div className="manual-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)' }}>
              <Icon name="flask" size={12} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.07em', textTransform: 'uppercase' }}>MN-LAB-01</span>
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 500 }}>พ.ศ. 2569 · Rev. 13</span>
          </div>
          <h1 className="manual-title">
            {lang === 'th' ? 'คู่มือการใช้บริการห้องปฏิบัติการ' : 'Laboratory Services Manual'}
          </h1>
          <p className="manual-header-subtitle" style={{ margin: '7px 0 0', color: 'var(--muted)', fontSize: 13.5, maxWidth: 720, lineHeight: 1.65 }}>
            {lang === 'th'
              ? 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี — แนวทางปฏิบัติสำหรับการเก็บสิ่งส่งตรวจ และรายงานผลตัวอย่างทางห้องปฏิบัติการ'
              : 'Medical Technology Department, Chonburi Hospital — procedures for collection, transport, testing, and reporting of laboratory specimens.'}
          </p>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="manual-mobile-topbar">
        <div className="manual-mobile-section-bar">
          <Icon name={activeLabel?.icon as any} size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span className="manual-mobile-section-name">{lang === 'th' ? activeLabel?.th : activeLabel?.en}</span>
        </div>
        <nav className="manual-mobile-nav-grid">
          {MANUAL_SECTIONS.map(s => {
            const active = s.id === activeSection
            const label = shortLabel(s)
            return (
              <button key={s.id} onClick={() => goSection(s.id)} className="manual-mobile-nav-item"
                style={{ background: active ? 'var(--primary-soft)' : 'var(--card)' }}>
                <div className="manual-mobile-nav-icon" style={{ background: active ? 'var(--primary)' : 'var(--surface-2)' }}>
                  <Icon name={s.icon as any} size={17} style={{ color: active ? '#fff' : 'var(--muted)' }} />
                </div>
                <span className="manual-mobile-nav-label" style={{ color: active ? 'var(--primary)' : 'var(--ink)' }}>
                  {lang === 'th' ? label.th : label.en}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Two-column layout */}
      <div className="manual-layout">

        {/* Sidebar */}
        <aside className="manual-sidebar">
          <div className="manual-sidebar-nav">
            <div className="manual-sidebar-nav-header">
              {lang === 'th' ? 'สารบัญ' : 'Contents'}
            </div>
            {MANUAL_SECTIONS.map((s) => {
              const active = s.id === activeSection
              return (
                <button key={s.id} onClick={() => goSection(s.id)}
                  className={active ? 'manual-nav-btn manual-nav-active' : 'manual-nav-btn'}>
                  <Icon name={s.icon as any} size={15} style={{ flexShrink: 0 }} />
                  <span style={{ lineHeight: 1.35 }}>{lang === 'th' ? s.th : s.en}</span>
                </button>
              )
            })}
          </div>

          <div className="manual-phone-dir">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>
              <Icon name="phone" size={13} style={{ color: 'var(--primary)' }} />
              {lang === 'th' ? 'เบอร์โทรภายใน' : 'Internal extensions'}
            </div>
            {PHONE_DIRECTORY.map(({ label, ext }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < PHONE_DIRECTORY.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span>{label}</span>
                <strong style={{ color: 'var(--ink)', fontFamily: '"IBM Plex Mono",monospace' }}>{ext}</strong>
              </div>
            ))}
          </div>

          {/* Head-of-department contact QR */}
          <div className="manual-qr-box">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--ink)', fontWeight: 700, fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
              <Icon name="mail" size={13} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
              <span>
                {lang === 'th'
                  ? 'ช่องทางการสื่อสารถึงหัวหน้ากลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี'
                  : 'Contact the Head of the Medical Technology Department, Chonburi Hospital'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img src="/images/qr-mt-head.png" alt={lang === 'th' ? 'QR code ช่องทางติดต่อหัวหน้ากลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี' : 'QR code to contact the Head of the Medical Technology Department'} />
            </div>
          </div>
        </aside>

        {/* Content area */}
        <div className="manual-content">

          {editMode ? (
            /* ── EDIT MODE ── */
            <div className="manual-editor" style={{ border: '2px solid var(--primary)', borderRadius: 12, overflow: 'hidden' }}>

              {/* Edit mode header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '8px 14px', background: 'var(--primary)', color: '#fff',
              }}>
                <Icon name="edit" size={14} style={{ color: '#fff', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
                  แก้ไขเนื้อหา — {activeLabel?.th}
                </span>
                {/* Lang tabs */}
                {(['th', 'en'] as const).map(l => (
                  <button key={l} onClick={() => setEditLang(l)}
                    style={{
                      padding: '3px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      background: editLang === l ? '#fff' : 'rgba(255,255,255,.2)',
                      color: editLang === l ? 'var(--primary)' : '#fff',
                      transition: 'all .15s',
                    }}>
                    {l === 'th' ? 'ภาษาไทย' : 'English'}
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
                padding: '4px 8px', borderBottom: '1px solid var(--border)',
                background: 'var(--surface-2)',
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
                {divider}
                <select value={fSize}
                  onFocus={() => { const sel = window.getSelection(); savedSel.current = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null }}
                  onChange={e => {
                    const v = e.target.value; if (!v) return; setFSize('')
                    const px = ({ '2': '13px', '3': '16px', '4': '18px', '5': '24px' } as Record<string, string>)[v] ?? '16px'
                    const sel = window.getSelection()
                    if (savedSel.current && sel) { sel.removeAllRanges(); sel.addRange(savedSel.current) }
                    bodyRef.current?.focus()
                    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
                    const range = sel.getRangeAt(0); const span = document.createElement('span'); span.style.fontSize = px
                    try { range.surroundContents(span) } catch { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span) }
                    syncBody()
                  }}
                  style={{ height: 24, padding: '0 4px', borderRadius: 5, border: '1px solid var(--border)', fontSize: 11, fontFamily: 'inherit', color: 'var(--muted)', background: 'var(--surface-2)', cursor: 'pointer', outline: 'none', appearance: 'none' as const }}>
                  <option value="">ขนาด</option>
                  <option value="2">เล็ก</option>
                  <option value="3">ปกติ</option>
                  <option value="4">ใหญ่</option>
                  <option value="5">ใหญ่มาก</option>
                </select>
                {divider}
                {/* Color picker */}
                <div ref={colorPickerRef} style={{ position: 'relative' }}>
                  <ToolBtn title="สีตัวอักษร" active={showColorPicker}
                    onClick={() => {
                      const sel = window.getSelection()
                      savedSel.current = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null
                      setShowColorPicker(v => !v)
                    }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: selectedColor === '#FFFFFF' ? 'var(--ink)' : selectedColor, lineHeight: 1 }}>A</span>
                      <span style={{ width: 14, height: 3, borderRadius: 1, background: selectedColor, display: 'block', boxShadow: selectedColor === '#FFFFFF' ? 'inset 0 0 0 1px #CBD5E1' : 'none' }} />
                    </div>
                  </ToolBtn>
                  {showColorPicker && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', marginBottom: 7 }}>สีตัวอักษร</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 22px)', gap: 5 }}>
                        {COLOR_SWATCHES.map(c => (
                          <button key={c} type="button" onMouseDown={e => { e.preventDefault(); applyColor(c) }}
                            style={{ width: 22, height: 22, borderRadius: 5, padding: 0, border: c === selectedColor ? '2px solid var(--primary)' : '2px solid transparent', background: c, cursor: 'pointer', outline: 'none', boxSizing: 'border-box', boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #CBD5E1' : '0 1px 3px rgba(0,0,0,.2)' }} />
                        ))}
                      </div>
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>กำหนดเอง</span>
                        <input type="color" value={selectedColor === '#FFFFFF' ? '#ffffff' : selectedColor} onChange={e => applyColor(e.target.value)}
                          style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', padding: 1, cursor: 'pointer', background: 'none' }} />
                      </div>
                    </div>
                  )}
                </div>
                {divider}
                <ToolBtn title="ชิดซ้าย" onClick={() => execFmt('justifyLeft')}><AlignLeftIcon /></ToolBtn>
                <ToolBtn title="กึ่งกลาง" onClick={() => execFmt('justifyCenter')}><AlignCenterIcon /></ToolBtn>
                <ToolBtn title="ชิดขวา" onClick={() => execFmt('justifyRight')}><AlignRightIcon /></ToolBtn>
                {divider}
                <ToolBtn title="ทำลิ้งค์" onClick={handleLink}><Icon name="globe" size={12} /></ToolBtn>
                {divider}
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => imageRef.current?.click()} disabled={imageUploading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 5, border: '1px solid transparent', background: 'transparent', fontSize: 11, fontWeight: 600, color: imageUploading ? 'var(--muted)' : 'var(--ink)', cursor: imageUploading ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .1s', flexShrink: 0 }}
                  onMouseEnter={e => { if (!imageUploading) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}>
                  <Icon name="upload" size={11} />
                  {imageUploading ? 'กำลังอัปโหลด...' : 'รูปภาพ'}
                </button>
                <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = '' }} />
              </div>

              {/* Editable body */}
              <div ref={bodyRef} contentEditable suppressContentEditableWarning
                onInput={syncBody}
                onPaste={e => {
                  const html = e.clipboardData.getData('text/html')
                  if (!html) return
                  e.preventDefault()
                  document.execCommand('insertHTML', false, sanitizeRichHtml(html))
                  syncBody()
                }}
                onKeyUp={() => setFmtState({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') })}
                data-placeholder="พิมพ์เนื้อหาที่นี่..."
                style={{ minHeight: 300, padding: '16px 20px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', lineHeight: 1.75, cursor: 'text' }}
              />

              {/* Edit mode footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>
                  <Icon name="check" size={14} style={{ color: '#fff' }} />
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => {
                  setEditMode(false)
                  // Reset to DB state so interactive sections (e.g. collection tabs) work correctly
                  setLocalSections(prev => ({
                    ...prev,
                    [activeSection]: dbSections[activeSection] ?? { th: '', en: '' },
                  }))
                }} disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ยกเลิก
                </button>
                {hasCustomContent && (
                  <button
                    onClick={async () => {
                      if (!window.confirm('ล้างเนื้อหาที่แก้ไขไว้ทั้งหมด และกลับไปใช้เนื้อหาต้นฉบับ?')) return
                      setSaving(true)
                      try {
                        const res = await fetch(`/api/admin/manual/${activeSection}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ body_html_th: '', body_html_en: '' }),
                        })
                        if (!res.ok) { toast((await res.json()).error ?? 'ล้างไม่สำเร็จ', false); return }
                        setLocalSections(prev => ({ ...prev, [activeSection]: { th: '', en: '' } }))
                        if (bodyRef.current) bodyRef.current.innerHTML = ''
                        toast('ล้างแล้ว — กลับไปใช้เนื้อหาต้นฉบับ')
                        setEditMode(false)
                      } catch { toast('เกิดข้อผิดพลาด', false) }
                      finally { setSaving(false) }
                    }}
                    disabled={saving}
                    style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ล้าง → ใช้เนื้อหาต้นฉบับ
                  </button>
                )}
              </div>
            </div>

          ) : (
            /* ── VIEW MODE ── */
            <>
              {/* Edit button — hidden for collection/transport (content lives in sub-component files, not DB) */}
              {canEdit && !['collection', 'transport'].includes(activeSection) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button
                    onClick={() => {
                      setEditLang(lang)
                      if (!localSections[activeSection]?.[lang]?.trim()) {
                        const html = staticContentRef.current?.innerHTML ?? ''
                        setLocalSections(prev => ({
                          ...prev,
                          [activeSection]: {
                            th: lang === 'th' ? html : (prev[activeSection]?.th ?? ''),
                            en: lang === 'en' ? html : (prev[activeSection]?.en ?? ''),
                          },
                        }))
                      }
                      setEditMode(true)
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--card)',
                      color: 'var(--muted)', fontSize: 12.5, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                  >
                    <Icon name="edit" size={12} />
                    แก้ไขเนื้อหา
                  </button>
                </div>
              )}

              {/* Content: DB override (if saved) or static React component.
                  collection/transport always use React component to preserve interactive tabs */}
              {displayHtml?.trim() && !['collection', 'transport'].includes(activeSection) ? (
                <div dangerouslySetInnerHTML={{ __html: displayHtml }}
                  style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ink)' }}
                  className="manual-db-content" />
              ) : (
                <div ref={staticContentRef}>
                  {activeSection === 'home'       && <ManualHome lang={lang} goto={goSection} />}
                  {activeSection === 'collection' && <ManualCollection lang={lang} />}
                  {activeSection === 'transport'  && <ManualTransport lang={lang} />}
                  {activeSection === 'addon'      && <ManualAddon lang={lang} />}
                  {activeSection === 'report'     && <ManualReport lang={lang} />}
                  {activeSection === 'outlab'     && <ManualOutLab lang={lang} />}
                  {activeSection === 'micro'      && <ManualMicrobiology lang={lang} />}
                  {activeSection === 'bloodbank'  && <ManualBloodBank lang={lang} />}
                  {activeSection === 'amendment'  && <ManualAmendment lang={lang} />}
                </div>
              )}
            </>
          )}

          {/* Prev / Next */}
          {!editMode && (prev || next) && (
            <div className="manual-prevnext">
              {prev ? (
                <button onClick={() => goSection(prev.id)} className="manual-prevnext-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="arrowLeft" size={14} style={{ color: 'var(--muted)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>{lang === 'th' ? 'ก่อนหน้า' : 'Previous'}</div>
                    <div className="manual-prevnext-title" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>{lang === 'th' ? prev.th : prev.en}</div>
                  </div>
                </button>
              ) : <div />}
              {next ? (
                <button onClick={() => goSection(next.id)} className="manual-prevnext-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', cursor: 'pointer', fontFamily: 'inherit', justifyContent: 'flex-end', textAlign: 'right', transition: 'all .15s' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>{lang === 'th' ? 'ถัดไป' : 'Next'}</div>
                    <div className="manual-prevnext-title" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>{lang === 'th' ? next.th : next.en}</div>
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="arrowRight" size={14} style={{ color: 'var(--primary)' }} />
                  </div>
                </button>
              ) : <div />}
            </div>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  )
}
