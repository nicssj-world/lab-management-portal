'use client'

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'

export type TeamOrgAssignmentPerson = {
  id: string
  name: string
  dept: string | null
  position_title: string | null
  dept_role: string | null
  is_section_head: boolean
  team_org_visible: boolean
}

export type TeamOrgAssignmentSection = {
  id: string
  title: string
  depts: string[]
}

type Props = {
  people: TeamOrgAssignmentPerson[]
  sections: TeamOrgAssignmentSection[]
  initialSectionId?: string
  label?: string
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  minHeight: 34, padding: '6px 10px', borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--primary) 28%, var(--border))',
  background: 'var(--card)', color: 'var(--primary)',
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const inputStyle: CSSProperties = {
  width: '100%', minHeight: 40, padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

const fieldLabel: CSSProperties = {
  display: 'block', marginBottom: 5, color: 'var(--muted)', fontSize: 12, fontWeight: 700,
}

export function TeamOrgAssignmentButton({ people, sections, initialSectionId, label = 'จัดคนเข้ากล่อง' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={buttonStyle}
        aria-haspopup="dialog"
      >
        <Icon name="users" size={14} /> {label}
      </button>
      {open && (
        <AssignmentDialog
          people={people}
          sections={sections}
          initialSectionId={initialSectionId}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}

export function TeamOrgRemoveButton({ personId, personName }: { personId: string; personName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!window.confirm(`นำ ${personName} ออกจากกล่องงานหรือไม่?`)) return
    setBusy(true)
    try {
      const response = await fetch('/api/admin/personnel/manage/dept-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: personId, teamOrgVisible: false }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'นำบุคลากรออกจากผังไม่สำเร็จ')
      router.refresh()
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : 'นำบุคลากรออกจากผังไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      title="นำออกจากกล่องงาน"
      aria-label={`นำ ${personName} ออกจากกล่องงาน`}
      style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, padding: 0, border: '1px solid color-mix(in srgb, var(--danger) 32%, var(--border))', borderRadius: 8, background: 'var(--card)', color: 'var(--danger)', cursor: busy ? 'default' : 'pointer', opacity: busy ? .55 : 1 }}
    >
      <Icon name="eyeOff" size={14} />
    </button>
  )
}

function AssignmentDialog({ people, sections, initialSectionId, onClose, onSaved }: Props & { onClose: () => void; onSaved: () => void }) {
  const titleId = useId()
  const firstFieldRef = useRef<HTMLSelectElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [personId, setPersonId] = useState('')
  const [targetSectionId, setTargetSectionId] = useState(initialSectionId ?? sections[0]?.id ?? '')
  const [savedDept, setSavedDept] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedPerson = people.find((person) => person.id === personId) ?? null
  const targetSection = sections.find((section) => section.id === targetSectionId) ?? null
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return people
    return people.filter((person) => [person.name, person.dept ?? '', person.position_title ?? '']
      .some((value) => value.toLocaleLowerCase().includes(query)))
  }, [people, search])
  const visiblePeople = useMemo(() => {
    if (selectedPerson && !filteredPeople.some((person) => person.id === selectedPerson.id)) return [selectedPerson, ...filteredPeople]
    return filteredPeople
  }, [filteredPeople, selectedPerson])
  const currentSection = selectedPerson?.dept
    ? sections.find((section) => section.depts.includes(selectedPerson.dept!))
    : null

  useEffect(() => {
    const section = sections.find((item) => item.id === targetSectionId)
    if (!section) { setSavedDept(''); return }
    setSavedDept((current) => current && section.depts.includes(current) ? current : section.depts[0] ?? '')
  }, [sections, targetSectionId])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    const frame = window.requestAnimationFrame(() => firstFieldRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', closeOnEscape)
      previousFocusRef.current?.focus()
    }
  }, [onClose])

  function selectPerson(nextId: string) {
    setPersonId(nextId)
    const person = people.find((item) => item.id === nextId)
    if (person?.dept && targetSection?.depts.includes(person.dept)) setSavedDept(person.dept)
  }

  async function save() {
    if (!personId) { setError('กรุณาเลือกบุคลากร'); return }
    if (!targetSection || !savedDept) { setError('กรุณาเลือกกล่องงาน'); return }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/personnel/manage/dept-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: personId, dept: savedDept, teamOrgVisible: true }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'บันทึกการจัดคนไม่สำเร็จ')
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกการจัดคนไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function removeFromChart() {
    if (!selectedPerson || !selectedPerson.team_org_visible) return
    if (!window.confirm(`นำ ${selectedPerson.name} ออกจากกล่องงานหรือไม่?`)) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/personnel/manage/dept-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedPerson.id, teamOrgVisible: false }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'นำบุคลากรออกจากผังไม่สำเร็จ')
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'นำบุคลากรออกจากผังไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.52)' }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ width: '100%', maxWidth: 520, maxHeight: 'min(720px, 92vh)', overflow: 'auto', borderRadius: 16, background: 'var(--card)', boxShadow: '0 24px 70px rgba(15,23,42,.28)' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '17px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 id={titleId} style={{ margin: 0, color: 'var(--ink)', fontSize: 16, lineHeight: 1.35 }}>จัดคนเข้ากล่องงาน</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>เลือกบุคลากรและกล่องที่ต้องการให้แสดง</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer' }}>
            <Icon name="x" size={17} />
          </button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, padding: 20 }}>
          <div>
            <label htmlFor={`${titleId}-search`} style={fieldLabel}>ค้นหาบุคลากร</label>
            <input id={`${titleId}-search`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="พิมพ์ชื่อ หน่วยงาน หรือตำแหน่ง" style={inputStyle} />
          </div>

          <div>
            <label htmlFor={`${titleId}-person`} style={fieldLabel}>บุคลากร</label>
            <select ref={firstFieldRef} id={`${titleId}-person`} value={personId} onChange={(event) => selectPerson(event.target.value)} style={inputStyle}>
              <option value="">— เลือกบุคลากร —</option>
              {visiblePeople.map((person) => <option key={person.id} value={person.id}>{person.name}{person.dept ? ` · ${person.dept}` : ''}{!person.team_org_visible ? ' · ไม่แสดงในกล่องงาน' : ''}</option>)}
            </select>
            {filteredPeople.length === 0 && <div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 12 }}>ไม่พบรายชื่อที่ค้นหา</div>}
          </div>

          {selectedPerson && (
            <div style={{ padding: '9px 11px', borderRadius: 9, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--ink)' }}>{selectedPerson.name}</strong>
              {selectedPerson.team_org_visible
                ? <><br />อยู่ในขณะนี้: {currentSection?.title ?? selectedPerson.dept ?? 'ยังไม่ได้ระบุหน่วยงาน'}</>
                : <><br />สถานะกล่องงาน: <strong style={{ color: 'var(--danger)' }}>ไม่แสดงในกล่องงาน</strong>{selectedPerson.dept ? ` · หน่วยงานเดิม: ${selectedPerson.dept}` : ''}</>}
            </div>
          )}

          <div>
            <label htmlFor={`${titleId}-section`} style={fieldLabel}>กล่องงานปลายทาง</label>
            <select id={`${titleId}-section`} value={targetSectionId} onChange={(event) => setTargetSectionId(event.target.value)} style={inputStyle}>
              <option value="">— เลือกกล่องงาน —</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
          </div>

          {targetSection && targetSection.depts.length > 1 && (
            <div>
              <label htmlFor={`${titleId}-dept`} style={fieldLabel}>หน่วยงานย่อยที่ใช้บันทึก</label>
              <select id={`${titleId}-dept`} value={savedDept} onChange={(event) => setSavedDept(event.target.value)} style={inputStyle}>
                {targetSection.depts.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
              </select>
              <div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.45 }}>กล่องนี้รวมหลายงาน จึงเลือกหน่วยงานย่อยสำหรับข้อมูลบุคลากร แต่จะแสดงรวมในกล่องเดียวกัน</div>
            </div>
          )}

          <div style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid color-mix(in srgb, var(--primary) 20%, var(--border))', background: 'color-mix(in srgb, var(--primary) 5%, var(--card))', color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5 }}>
            การบันทึกจะเปลี่ยน <strong style={{ color: 'var(--ink)' }}>หน่วยงาน</strong> ในข้อมูลบุคลากรด้วย
          </div>

          {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          {selectedPerson?.team_org_visible && <button type="button" onClick={removeFromChart} disabled={saving} style={{ ...buttonStyle, marginRight: 'auto', color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border))', opacity: saving ? .7 : 1 }}>
            <Icon name="eyeOff" size={14} /> นำออกจากกล่องงาน
          </button>}
          <button type="button" onClick={onClose} style={{ ...buttonStyle, color: 'var(--ink)', borderColor: 'var(--border)' }}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={saving} style={{ ...buttonStyle, borderColor: 'var(--primary)', background: 'var(--primary)', color: '#fff', opacity: saving ? .7 : 1 }}>
            <Icon name="check" size={14} /> {saving ? 'กำลังบันทึก…' : selectedPerson?.team_org_visible ? 'บันทึกการจัดคน' : 'นำกลับเข้ากล่อง'}
          </button>
        </footer>
      </section>
    </div>
  )
}
