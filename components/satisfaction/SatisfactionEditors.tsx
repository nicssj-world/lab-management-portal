'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'

type Person = { id: string; name: string | null; role: string | null; dept: string | null }

const MAX_SUGGESTIONS = 6

const initials = (name: string | null) => (name ?? '?').trim().charAt(0) || '?'
const subtitle = (person: Person) => person.dept || person.role || '—'

export function SatisfactionEditors() {
  const [people, setPeople] = useState<Person[]>([])
  const [editorIds, setEditorIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/satisfaction/editors')
      .then((response) => response.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPeople(data.people ?? [])
        setEditorIds(data.userIds ?? [])
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดรายชื่อไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const assigned = useMemo(
    () => editorIds.map((id) => byId.get(id)).filter((person): person is Person => Boolean(person)),
    [editorIds, byId],
  )

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return people
      .filter((person) => !editorIds.includes(person.id))
      .filter((person) => `${person.name ?? ''} ${person.dept ?? ''} ${person.role ?? ''}`.toLowerCase().includes(term))
      .slice(0, MAX_SUGGESTIONS)
  }, [search, people, editorIds])

  const commit = async (person: Person, enabled: boolean) => {
    const previous = editorIds
    setEditorIds((current) => (enabled ? [...current, person.id] : current.filter((id) => id !== person.id)))
    setPendingId(person.id)
    setError('')
    try {
      const response = await fetch('/api/admin/satisfaction/editors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: person.id, enabled }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'บันทึกไม่สำเร็จ')
    } catch (caught) {
      setEditorIds(previous)
      setError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setPendingId(null)
    }
  }

  const add = (person: Person) => {
    commit(person, true)
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

  const showList = open && search.trim().length > 0

  return (
    <Card padding={24}>
      <style>{`
        .sat-ed-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .sat-ed-count{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:12px;font-weight:800}
        .sat-ed-combo{position:relative;margin-top:18px}
        .sat-ed-input-wrap{position:relative;display:flex;align-items:center}
        .sat-ed-input-icon{position:absolute;left:12px;display:flex;color:var(--muted);pointer-events:none}
        .sat-ed-input{width:100%;box-sizing:border-box;min-height:44px;padding:11px 12px 11px 38px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);font:inherit;font-size:13px}
        .sat-ed-input::placeholder{color:var(--muted)}
        .sat-ed-input:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:2px;border-color:var(--primary)}
        .sat-ed-pop{position:absolute;z-index:30;top:calc(100% + 6px);left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:0 14px 38px rgba(15,23,42,.16);overflow:hidden;padding:5px}
        .sat-ed-opt{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:11px;min-height:44px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--ink);font:inherit;text-align:left;cursor:pointer;transition:background .15s}
        .sat-ed-opt:hover,.sat-ed-opt.is-active{background:var(--primary-soft)}
        .sat-ed-opt:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:-3px}
        .sat-ed-empty-opt{padding:14px 12px;color:var(--muted);font-size:12.5px}
        .sat-ed-avatar{flex-shrink:0;width:30px;height:30px;border-radius:999px;display:grid;place-items:center;background:var(--surface-2);color:var(--muted);font-size:12.5px;font-weight:800}
        .sat-ed-opt.is-active .sat-ed-avatar,.sat-ed-row .sat-ed-avatar{background:var(--primary);color:#fff}
        .sat-ed-meta{min-width:0;flex:1}
        .sat-ed-name{display:block;font-size:13px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sat-ed-sub{display:block;font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sat-ed-list{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
        .sat-ed-row{display:flex;align-items:center;gap:11px;padding:10px 12px;border:1px solid var(--border);border-radius:11px;background:var(--card);transition:border-color .15s,box-shadow .15s}
        .sat-ed-row:hover{border-color:color-mix(in srgb,var(--primary) 40%,var(--border));box-shadow:0 3px 10px rgba(15,23,42,.05)}
        .sat-ed-empty{margin-top:16px;padding:26px 18px;border:1px dashed var(--border);border-radius:12px;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.7}
        .sat-ed-skeleton{height:52px;border-radius:11px;background:var(--surface-2)}
        @media(prefers-reduced-motion:reduce){.sat-ed-opt,.sat-ed-row{transition:none}}
        @media(max-width:520px){.sat-ed-count{align-self:flex-start}}
      `}</style>

      <div className="sat-ed-head">
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: 'var(--ink)' }}>ผู้ได้รับมอบหมายแบบสำรวจความพึงพอใจ</h2>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, maxWidth: '68ch' }}>
            คนในรายการนี้จะแก้ไขได้ทั้งโมดูล (สร้าง/แก้ไข/เผยแพร่แบบสำรวจ และสร้าง/เปิด/ปิดรอบเก็บข้อมูล) โดยไม่ต้องเปลี่ยน role
            — Admin และ Manager มีสิทธิ์อยู่แล้ว ส่วนการจัดการความคิดเห็นยังจำกัดเฉพาะ Admin และ Manager
          </p>
        </div>
        <span className="sat-ed-count">
          <Icon name="users" size={14} /> {assigned.length} คน
        </span>
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 14, padding: 10, borderRadius: 8, color: 'var(--danger)', background: 'rgba(220,38,38,.08)' }}>
          {error}
        </div>
      )}

      <div className="sat-ed-combo" ref={boxRef}>
        <div className="sat-ed-input-wrap">
          <span className="sat-ed-input-icon" aria-hidden="true"><Icon name="search" size={16} /></span>
          <input
            ref={inputRef}
            className="sat-ed-input"
            value={search}
            disabled={loading}
            onChange={(event) => { setSearch(event.target.value); setOpen(true); setHighlight(0) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={loading ? 'กำลังโหลดรายชื่อ…' : 'ค้นหาชื่อ แผนก หรือตำแหน่ง เพื่อเพิ่มผู้ได้รับมอบหมาย'}
            role="combobox"
            aria-expanded={showList}
            aria-controls="sat-ed-listbox"
            aria-autocomplete="list"
            aria-label="ค้นหาบุคลากรเพื่อเพิ่มผู้ได้รับมอบหมาย"
          />
        </div>

        {showList && (
          <div className="sat-ed-pop" id="sat-ed-listbox" role="listbox">
            {suggestions.length === 0 ? (
              <p className="sat-ed-empty-opt">ไม่พบบุคลากรที่ตรงกับ “{search.trim()}” — ลองค้นด้วยชื่อหรือชื่อแผนก</p>
            ) : (
              suggestions.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={`sat-ed-opt${index === highlight ? ' is-active' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => add(person)}
                >
                  <span className="sat-ed-avatar" aria-hidden="true">{initials(person.name)}</span>
                  <span className="sat-ed-meta">
                    <span className="sat-ed-name">{person.name ?? '—'}</span>
                    <span className="sat-ed-sub">{subtitle(person)}</span>
                  </span>
                  <Icon name="plus" size={15} />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="sat-ed-list">
          {Array.from({ length: 2 }).map((_, index) => <div key={index} className="sat-ed-skeleton" />)}
        </div>
      ) : assigned.length === 0 ? (
        <div className="sat-ed-empty">
          ยังไม่มีผู้ได้รับมอบหมาย<br />
          ค้นหาชื่อในช่องด้านบนเพื่อเพิ่มคนแรก
        </div>
      ) : (
        <ul className="sat-ed-list">
          {assigned.map((person) => (
            <li key={person.id} className="sat-ed-row">
              <span className="sat-ed-avatar" aria-hidden="true">{initials(person.name)}</span>
              <span className="sat-ed-meta">
                <span className="sat-ed-name">{person.name ?? '—'}</span>
                <span className="sat-ed-sub">{subtitle(person)}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon="x"
                disabled={pendingId === person.id}
                onClick={() => commit(person, false)}
                aria-label={`ถอนสิทธิ์ ${person.name ?? 'ผู้ใช้'}`}
              >
                ถอน
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
