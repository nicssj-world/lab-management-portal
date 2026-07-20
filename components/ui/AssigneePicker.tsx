'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export type AssigneePerson = { id: string; name: string | null; role?: string | null; dept?: string | null }

const MAX_SUGGESTIONS = 6

const initials = (name: string | null) => (name ?? '?').trim().charAt(0) || '?'
const subtitle = (person: AssigneePerson) => person.dept || person.role || '—'

/**
 * Picks a handful of people out of a long staff list without rendering every row.
 * Assigned people stay visible at the top; everyone else sits behind a search box
 * (progressive disclosure) so the panel does not become a wall of checkboxes.
 *
 * Controlled: `selectedIds` comes from the parent, and `onToggle` performs the write.
 * Throwing from `onToggle` surfaces the message inline and leaves the list unchanged.
 */
export function AssigneePicker({
  people,
  selectedIds,
  onToggle,
  title,
  description,
  loading = false,
  searchPlaceholder = 'ค้นหาชื่อ แผนก หรือตำแหน่ง เพื่อเพิ่มผู้ได้รับมอบหมาย',
  emptyText = 'ยังไม่มีผู้ได้รับมอบหมาย',
  removeLabel = 'ถอน',
}: {
  people: AssigneePerson[]
  selectedIds: string[]
  onToggle: (userId: string, enabled: boolean) => Promise<void> | void
  title: string
  description?: React.ReactNode
  loading?: boolean
  searchPlaceholder?: string
  emptyText?: string
  removeLabel?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const assigned = useMemo(
    () => selectedIds.map((id) => byId.get(id)).filter((person): person is AssigneePerson => Boolean(person)),
    [selectedIds, byId],
  )

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return people
      .filter((person) => !selectedIds.includes(person.id))
      .filter((person) => `${person.name ?? ''} ${person.dept ?? ''} ${person.role ?? ''}`.toLowerCase().includes(term))
      .slice(0, MAX_SUGGESTIONS)
  }, [search, people, selectedIds])

  const commit = async (person: AssigneePerson, enabled: boolean) => {
    setPendingId(person.id)
    setError('')
    try {
      await onToggle(person.id, enabled)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setPendingId(null)
    }
  }

  const add = (person: AssigneePerson) => {
    void commit(person, true)
    setSearch('')
    setOpen(false)
    setHighlight(0)
    inputRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); return }
    if (!suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault(); setOpen(true)
      setHighlight((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      setHighlight((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const picked = suggestions[highlight]
      if (picked) add(picked)
    }
  }

  const listboxId = useMemo(() => `assignee-listbox-${Math.random().toString(36).slice(2, 9)}`, [])
  const showList = open && search.trim().length > 0

  return (
    <div className="assignee-picker">
      <style>{`
        .assignee-picker .ap-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .assignee-picker .ap-count{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:12px;font-weight:800}
        .assignee-picker .ap-combo{position:relative;margin-top:18px}
        .assignee-picker .ap-input-wrap{position:relative;display:flex;align-items:center}
        .assignee-picker .ap-input-icon{position:absolute;left:12px;display:flex;color:var(--muted);pointer-events:none}
        .assignee-picker .ap-input{width:100%;box-sizing:border-box;min-height:44px;padding:11px 12px 11px 38px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);font:inherit;font-size:13px}
        .assignee-picker .ap-input::placeholder{color:var(--muted)}
        .assignee-picker .ap-input:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:2px;border-color:var(--primary)}
        .assignee-picker .ap-pop{position:absolute;z-index:30;top:calc(100% + 6px);left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:0 14px 38px rgba(15,23,42,.16);overflow:hidden;padding:5px}
        .assignee-picker .ap-opt{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:11px;min-height:44px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--ink);font:inherit;text-align:left;cursor:pointer;transition:background .15s}
        .assignee-picker .ap-opt:hover,.assignee-picker .ap-opt.is-active{background:var(--primary-soft)}
        .assignee-picker .ap-opt:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:-3px}
        .assignee-picker .ap-empty-opt{margin:0;padding:14px 12px;color:var(--muted);font-size:12.5px}
        .assignee-picker .ap-avatar{flex-shrink:0;width:30px;height:30px;border-radius:999px;display:grid;place-items:center;background:var(--surface-2);color:var(--muted);font-size:12.5px;font-weight:800}
        .assignee-picker .ap-opt.is-active .ap-avatar,.assignee-picker .ap-row .ap-avatar{background:var(--primary);color:#fff}
        .assignee-picker .ap-meta{min-width:0;flex:1}
        .assignee-picker .ap-name{display:block;font-size:13px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .assignee-picker .ap-sub{display:block;font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .assignee-picker .ap-list{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
        .assignee-picker .ap-row{display:flex;align-items:center;gap:11px;padding:10px 12px;border:1px solid var(--border);border-radius:11px;background:var(--card);transition:border-color .15s,box-shadow .15s}
        .assignee-picker .ap-row:hover{border-color:color-mix(in srgb,var(--primary) 40%,var(--border));box-shadow:0 3px 10px rgba(15,23,42,.05)}
        .assignee-picker .ap-empty{margin-top:16px;padding:26px 18px;border:1px dashed var(--border);border-radius:12px;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.7}
        .assignee-picker .ap-skeleton{height:52px;border-radius:11px;background:var(--surface-2)}
        @media(prefers-reduced-motion:reduce){.assignee-picker .ap-opt,.assignee-picker .ap-row{transition:none}}
      `}</style>

      <div className="ap-head">
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: 'var(--ink)' }}>{title}</h2>
          {description && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, maxWidth: '68ch' }}>
              {description}
            </p>
          )}
        </div>
        <span className="ap-count">
          <Icon name="users" size={14} /> {assigned.length} คน
        </span>
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 14, padding: 10, borderRadius: 8, color: 'var(--danger)', background: 'rgba(220,38,38,.08)' }}>
          {error}
        </div>
      )}

      <div className="ap-combo" ref={boxRef}>
        <div className="ap-input-wrap">
          <span className="ap-input-icon" aria-hidden="true"><Icon name="search" size={16} /></span>
          <input
            ref={inputRef}
            className="ap-input"
            value={search}
            disabled={loading}
            onChange={(event) => { setSearch(event.target.value); setOpen(true); setHighlight(0) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={loading ? 'กำลังโหลดรายชื่อ…' : searchPlaceholder}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-label={searchPlaceholder}
          />
        </div>

        {showList && (
          <div className="ap-pop" id={listboxId} role="listbox">
            {suggestions.length === 0 ? (
              <p className="ap-empty-opt">ไม่พบบุคลากรที่ตรงกับ “{search.trim()}” — ลองค้นด้วยชื่อหรือชื่อแผนก</p>
            ) : (
              suggestions.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={`ap-opt${index === highlight ? ' is-active' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => add(person)}
                >
                  <span className="ap-avatar" aria-hidden="true">{initials(person.name)}</span>
                  <span className="ap-meta">
                    <span className="ap-name">{person.name ?? '—'}</span>
                    <span className="ap-sub">{subtitle(person)}</span>
                  </span>
                  <Icon name="plus" size={15} />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="ap-list">
          {Array.from({ length: 2 }).map((_, index) => <div key={index} className="ap-skeleton" />)}
        </div>
      ) : assigned.length === 0 ? (
        <div className="ap-empty">
          {emptyText}<br />
          ค้นหาชื่อในช่องด้านบนเพื่อเพิ่มคนแรก
        </div>
      ) : (
        <ul className="ap-list">
          {assigned.map((person) => (
            <li key={person.id} className="ap-row">
              <span className="ap-avatar" aria-hidden="true">{initials(person.name)}</span>
              <span className="ap-meta">
                <span className="ap-name">{person.name ?? '—'}</span>
                <span className="ap-sub">{subtitle(person)}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon="x"
                disabled={pendingId === person.id}
                onClick={() => commit(person, false)}
                aria-label={`${removeLabel}สิทธิ์ ${person.name ?? 'ผู้ใช้'}`}
              >
                {removeLabel}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
