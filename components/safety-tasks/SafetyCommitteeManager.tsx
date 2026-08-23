'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { normalizeRole } from '@/lib/roles'

export type SafetyCommitteeStaff = {
  id: string
  name: string | null
  role: string
}

export type SafetyCommitteeEditor = {
  user_id: string
}

type Props = {
  canManage: boolean
  staff: SafetyCommitteeStaff[]
  initialEditors: SafetyCommitteeEditor[]
  onClose: () => void
  onEditorsChange?: (userId: string, enabled: boolean) => void
}

async function requestEditorChange(body: { userId: string; enabled: boolean }) {
  const response = await fetch('/api/admin/lab-map/safety-editors', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'บันทึกคณะทำงานไม่สำเร็จ')
  return payload as { userId: string; enabled: boolean }
}

function initials(name: string | null, id: string) {
  const value = (name ?? id).trim()
  return value ? value.slice(0, 1).toUpperCase() : '?'
}

export function SafetyCommitteeManager({ canManage, staff, initialEditors, onClose, onEditorsChange }: Props) {
  const dialogRef = useRef<HTMLElement>(null)
  const [editors, setEditors] = useState<Set<string>>(() => new Set(initialEditors.map(item => item.user_id)))
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const automaticPeople = useMemo(
    () => staff.filter(person => ['Admin', 'Manager'].includes(normalizeRole(person.role))),
    [staff],
  )
  const selectablePeople = useMemo(
    () => staff.filter(person => !['Admin', 'Manager'].includes(normalizeRole(person.role))),
    [staff],
  )
  const visiblePeople = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th')
    if (!normalized) return selectablePeople
    return selectablePeople.filter(person => `${person.name ?? ''} ${person.role}`.toLocaleLowerCase('th').includes(normalized))
  }, [query, selectablePeople])
  const assignedCount = editors.size

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  async function saveMember(person: SafetyCommitteeStaff, enabled: boolean) {
    if (!canManage || busyId) return
    setBusyId(person.id)
    setError('')
    setMessage('')
    try {
      await requestEditorChange({ userId: person.id, enabled })
      setEditors(current => {
        const next = new Set(current)
        if (enabled) next.add(person.id)
        else next.delete(person.id)
        return next
      })
      onEditorsChange?.(person.id, enabled)
      setMessage(enabled ? `เพิ่ม ${person.name ?? 'ผู้ใช้รายนี้'} เข้าคณะทำงานแล้ว` : `นำ ${person.name ?? 'ผู้ใช้รายนี้'} ออกจากคณะทำงานแล้ว`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกคณะทำงานไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="safety-committee-layer">
      <button type="button" className="safety-committee-backdrop" aria-label="ปิดหน้าต่างคณะทำงานความปลอดภัย" onClick={onClose} />
      <section
        ref={dialogRef}
        className="safety-committee-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-committee-title"
        tabIndex={-1}
      >
        <header className="safety-committee-header">
          <div className="safety-committee-title-wrap">
            <span className="safety-committee-mark" aria-hidden="true"><Icon name="users" size={18} /></span>
            <div>
              <span className="safety-committee-kicker">SAFETY WORKING GROUP</span>
              <h2 id="safety-committee-title">คณะทำงานความปลอดภัย</h2>
              <p>รายชื่อผู้ดูแลงานความปลอดภัยและหลักฐานภายในโมดูลนี้</p>
            </div>
          </div>
          <button type="button" className="safety-committee-close" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="safety-committee-status" aria-live="polite">
          <span><Icon name="shieldCheck" size={15} /> สมาชิกที่แต่งตั้ง <strong>{assignedCount}</strong> คน</span>
          <Badge color={canManage ? 'blue' : 'gray'}>{canManage ? 'โหมดจัดการ' : 'ดูอย่างเดียว'}</Badge>
        </div>

        <div className="safety-committee-body">
          <section className="safety-committee-scope" aria-label="ขอบเขตสิทธิ์">
            <Icon name="shieldCheck" size={20} />
            <div>
              <strong>สิทธิ์เฉพาะงานความปลอดภัย</strong>
              <p>สมาชิกที่แต่งตั้งจัดการงาน หลักฐาน ทะเบียนอุปกรณ์ แผนอพยพ และข้อมูลความปลอดภัยได้เทียบเท่า Admin ภายในขอบเขตนี้ โดยไม่เปลี่ยนสิทธิ์โมดูลอื่น</p>
            </div>
          </section>

          {automaticPeople.length > 0 ? (
            <section className="safety-committee-automatic" aria-labelledby="safety-committee-automatic-title">
              <div className="safety-committee-section-heading">
                <div><h3 id="safety-committee-automatic-title">สิทธิ์อัตโนมัติ</h3><p>Admin และ Manager มีสิทธิ์จัดการความปลอดภัยอยู่แล้ว</p></div>
                <span>{automaticPeople.length} คน</span>
              </div>
              <div className="safety-committee-automatic-list">
                {automaticPeople.map(person => <div key={person.id} className="safety-committee-automatic-person">
                  <span className="safety-committee-avatar" aria-hidden="true">{initials(person.name, person.id)}</span>
                  <span><strong>{person.name ?? person.id}</strong><small>{normalizeRole(person.role)}</small></span>
                  <Badge color="blue">อัตโนมัติ</Badge>
                </div>)}
              </div>
            </section>
          ) : null}

          <div className="safety-committee-list-heading">
            <div><h3>สมาชิกจากผู้ใช้ในโปรเจกต์</h3><p>เลือกผู้ใช้ได้ทุกคนเพื่อเข้าคณะทำงานความปลอดภัย</p></div>
            <strong>{assignedCount} / {selectablePeople.length}</strong>
          </div>
          <label className="safety-committee-search">
            <span><Icon name="search" size={15} />ค้นหาชื่อหรือบทบาท</span>
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เช่น Manager, ชื่อผู้ใช้" />
          </label>

          {message ? <p className="safety-committee-message" role="status">{message}</p> : null}
          {error ? <p className="safety-committee-error" role="alert"><Icon name="alert" size={15} />{error}</p> : null}

          <div className="safety-committee-list" role="list" aria-label="รายชื่อผู้ใช้และคณะทำงานความปลอดภัย">
            {visiblePeople.map(person => {
              const assigned = editors.has(person.id)
              return (
                <article key={person.id} className={`safety-committee-person${assigned ? ' is-assigned' : ''}`} role="listitem">
                  <span className="safety-committee-avatar" aria-hidden="true">{initials(person.name, person.id)}</span>
                  <div className="safety-committee-person-copy">
                    <strong>{person.name ?? person.id}</strong>
                    <small>{normalizeRole(person.role)}</small>
                  </div>
                  {assigned ? <Badge color="green">สมาชิกคณะทำงาน</Badge> : <span className="safety-committee-unassigned">ยังไม่ได้แต่งตั้ง</span>}
                  <div className="safety-committee-person-actions">
                    {assigned ? <>
                      {canManage ? <Button size="lg" variant="secondary" disabled={busyId === person.id} onClick={() => void saveMember(person, false)}>ถอนออก</Button> : null}
                    </> : canManage ? <Button size="lg" icon="plus" disabled={busyId === person.id} onClick={() => void saveMember(person, true)}>เพิ่มเข้าคณะทำงาน</Button> : null}
                  </div>
                </article>
              )
            })}
            {!visiblePeople.length ? <EmptyState title="ไม่พบผู้ใช้" hint={query ? 'ลองค้นหาด้วยชื่อ ตำแหน่ง หรือบทบาทอื่น' : 'ยังไม่มีผู้ใช้ที่แสดงในรายการ'} icon="users" /> : null}
          </div>
        </div>

        <footer className="safety-committee-footer">
          <span>{canManage ? 'การเพิ่มหรือถอนสมาชิกจะบันทึกทันที' : 'ติดต่อ Admin ระบบ หากต้องการเปลี่ยนคณะทำงาน'}</span>
          <Button variant="secondary" size="lg" onClick={onClose}>ปิด</Button>
        </footer>
      </section>
      <style>{`
        .safety-committee-layer{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px}
        .safety-committee-backdrop{position:absolute;inset:0;width:100%;height:100%;border:0;background:color-mix(in srgb,var(--ink) 48%,transparent);cursor:default}
        .safety-committee-dialog{position:relative;z-index:1;display:flex;flex-direction:column;width:min(900px,100%);max-height:min(820px,calc(100dvh - 32px));overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:0 24px 72px color-mix(in srgb,var(--ink) 25%,transparent);animation:safety-committee-enter .2s ease-out}
        @keyframes safety-committee-enter{from{transform:translateY(10px) scale(.985);opacity:0}to{transform:none;opacity:1}}
        .safety-committee-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 16px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--primary-soft) 45%,var(--card))}
        .safety-committee-title-wrap{display:flex;align-items:flex-start;gap:12px;min-width:0}.safety-committee-mark{display:grid;place-items:center;flex:0 0 auto;width:42px;height:42px;border-radius:12px;background:var(--primary);color:#fff}.safety-committee-kicker{display:block;margin-bottom:4px;color:var(--primary);font-size:10px;font-weight:800;letter-spacing:.12em}.safety-committee-header h2{margin:0;color:var(--ink);font-size:20px;line-height:1.25;letter-spacing:-.02em}.safety-committee-header p{max-width:620px;margin:5px 0 0;color:var(--muted);font-size:12px;line-height:1.55}.safety-committee-close{display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--muted);cursor:pointer;transition:color .18s ease,border-color .18s ease,background-color .18s ease}.safety-committee-close:hover{border-color:var(--primary);background:var(--primary-soft);color:var(--primary)}
        .safety-committee-status{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 22px;border-bottom:1px solid var(--border);color:var(--muted);font-size:12px}.safety-committee-status>span:first-child{display:inline-flex;align-items:center;gap:6px}.safety-committee-status>span:first-child svg{color:var(--primary)}.safety-committee-status strong{color:var(--ink)}
        .safety-committee-body{min-height:0;overflow:auto;padding:18px 22px 22px}.safety-committee-scope{display:grid;grid-template-columns:auto minmax(0,1fr);gap:11px;padding:13px 14px;border:1px solid color-mix(in srgb,var(--primary) 25%,var(--border));border-radius:12px;background:color-mix(in srgb,var(--primary-soft) 52%,var(--card));color:var(--primary)}.safety-committee-scope>div{min-width:0}.safety-committee-scope strong{display:block;color:var(--ink);font-size:13px}.safety-committee-scope p{margin:3px 0 0;color:var(--muted);font-size:12px;line-height:1.55}
        .safety-committee-automatic{margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}.safety-committee-section-heading,.safety-committee-list-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.safety-committee-section-heading h3,.safety-committee-list-heading h3{margin:0;color:var(--ink);font-size:15px}.safety-committee-section-heading p,.safety-committee-list-heading p{margin:3px 0 0;color:var(--muted);font-size:11px;line-height:1.5}.safety-committee-section-heading>span,.safety-committee-list-heading>strong{flex:0 0 auto;color:var(--primary);font-size:12px}.safety-committee-automatic-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.safety-committee-automatic-person{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 9px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)}.safety-committee-automatic-person>span:nth-child(2){display:grid;gap:1px;min-width:0}.safety-committee-automatic-person strong{font-size:12px}.safety-committee-automatic-person small{color:var(--muted);font-size:10px}
        .safety-committee-list-heading{margin-top:22px}.safety-committee-search{display:grid;gap:5px;margin-top:10px;color:var(--muted);font-size:11px;font-weight:700}.safety-committee-search>span{display:inline-flex;align-items:center;gap:6px}.safety-committee-search input{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--border);border-radius:9px;background:var(--card);color:var(--ink);font:inherit}.safety-committee-search input:focus{border-color:var(--primary);outline:0;box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 14%,transparent)}.safety-committee-search input::placeholder{color:var(--muted);opacity:.9}
        .safety-committee-message,.safety-committee-error{display:flex;align-items:center;gap:7px;margin:10px 0 0;padding:9px 10px;border-radius:9px;font-size:12px}.safety-committee-message{border:1px solid color-mix(in srgb,var(--success) 28%,var(--border));background:color-mix(in srgb,var(--success) 8%,var(--card));color:var(--success)}.safety-committee-error{border:1px solid color-mix(in srgb,var(--danger) 28%,var(--border));background:color-mix(in srgb,var(--danger) 8%,var(--card));color:var(--danger)}
        .safety-committee-list{display:grid;gap:8px;margin-top:12px}.safety-committee-person{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:11px;border:1px solid var(--border);border-radius:11px;background:var(--card);transition:border-color .18s ease,background-color .18s ease,box-shadow .18s ease}.safety-committee-person:hover,.safety-committee-person.is-assigned{border-color:color-mix(in srgb,var(--primary) 38%,var(--border));background:color-mix(in srgb,var(--primary-soft) 20%,var(--card))}.safety-committee-avatar{display:inline-grid;place-items:center;flex:0 0 auto;width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--primary) 14%,var(--card));color:var(--primary);font-size:13px;font-weight:800}.safety-committee-person-copy{display:grid;gap:2px;min-width:0}.safety-committee-person-copy strong{overflow:hidden;color:var(--ink);font-size:13px;text-overflow:ellipsis;white-space:nowrap}.safety-committee-person-copy small{overflow:hidden;color:var(--muted);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.safety-committee-unassigned{color:var(--muted);font-size:11px}.safety-committee-person-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}.safety-committee-person-actions button{min-width:44px}.safety-committee-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;border-top:1px solid var(--border);background:color-mix(in srgb,var(--surface-2) 65%,var(--card))}.safety-committee-footer>span{color:var(--muted);font-size:11px;line-height:1.45}
        @media(max-width:767px){.safety-committee-layer{padding:0}.safety-committee-dialog{max-height:100dvh;border-radius:0}.safety-committee-header{padding:16px}.safety-committee-header h2{font-size:18px}.safety-committee-header p{font-size:11px}.safety-committee-body{padding:14px 16px 18px}.safety-committee-status{padding:9px 16px}.safety-committee-person{grid-template-columns:auto minmax(0,1fr);align-items:start;padding:12px}.safety-committee-unassigned,.safety-committee-person-actions{grid-column:2}.safety-committee-person-actions{justify-content:flex-start}.safety-committee-person-actions button{flex:1}.safety-committee-footer{align-items:stretch;flex-direction:column;padding:11px 16px}.safety-committee-footer button{width:100%}}
        @media(prefers-reduced-motion:reduce){.safety-committee-dialog,.safety-committee-close,.safety-committee-person{animation:none;transition:none}}
      `}</style>
    </div>
  )
}
