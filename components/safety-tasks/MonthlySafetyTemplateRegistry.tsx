'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'

type Profile = 'biohazard_spill_kit' | 'chemical_spill_kit' | 'nss_eyewash'
type Template = { id: string; profile: Profile; version: number; titleTh: string; active: boolean; createdAt: string; retiredAt: string | null; items: { itemKey: string; labelTh: string; expiryRequired: boolean; dateMode: 'none' | 'manufactured_or_packed' | 'purchased' }[] }
const PROFILES: { id: Profile; label: string; note: string }[] = [
  { id: 'biohazard_spill_kit', label: 'Biohazard', note: 'รายการตรวจชุดจัดการสิ่งส่งตรวจ/สารชีวภาพหก' },
  { id: 'chemical_spill_kit', label: 'Chemical', note: 'เริ่ม inactive จนกว่ารายการที่อนุมัติจะครบ' },
  { id: 'nss_eyewash', label: 'NSS', note: 'โครงสร้างแบบตรวจขวดน้ำยาล้างตา NSS' },
]

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'ดำเนินการไม่สำเร็จ')
  return body as T
}

export function MonthlySafetyTemplateRegistry() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [profile, setProfile] = useState<Profile>('biohazard_spill_kit')
  const [title, setTitle] = useState('')
  const [lines, setLines] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected = useMemo(() => templates.filter(item => item.profile === profile).sort((a, b) => b.version - a.version), [profile, templates])

  async function load() {
    const body = await json<{ templates: Template[] }>(await fetch('/api/admin/safety-tasks/monthly-form-templates', { cache: 'no-store' }))
    setTemplates(body.templates)
  }
  useEffect(() => { void load().catch(cause => setError((cause as Error).message)) }, [])
  function beginVersion() {
    const source = selected[0]
    setTitle(source?.titleTh ?? PROFILES.find(item => item.id === profile)?.label ?? '')
    setLines((source?.items ?? []).map(item => `${item.itemKey} | ${item.labelTh}`).join('\n'))
    setEditing(true); setError(''); setNotice('')
  }
  async function create() {
    setBusy(true); setError(''); setNotice('')
    try {
      const items = lines.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const [itemKey, ...labelParts] = line.split('|')
        const labelTh = labelParts.join('|').trim()
        if (!itemKey.trim() || !labelTh) throw new Error('แต่ละบรรทัดต้องเป็น “item-key | ชื่อรายการ”')
        return { itemKey: itemKey.trim(), labelTh, expiryRequired: true, dateMode: 'manufactured_or_packed' as const }
      })
      await json(await fetch('/api/admin/safety-tasks/monthly-form-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', profile, titleTh: title, items }) }))
      await load(); setEditing(false); setNotice('สร้าง Version ใหม่แบบ inactive แล้ว ตรวจสอบก่อนเปิดใช้งาน')
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  async function activate(template: Template) {
    if (!window.confirm(`เปิดใช้งาน ${template.titleTh} Version ${template.version}?\nVersion ปัจจุบันจะถูกเก็บเป็นประวัติ`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await json(await fetch('/api/admin/safety-tasks/monthly-form-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'activate', templateId: template.id }) }))
      await load(); setNotice(`เปิดใช้งาน Version ${template.version} แล้ว รอบใหม่จะ snapshot Version นี้`)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  return <section className="mtr">
    <header><div><span>MONTHLY FORM VERSIONS</span><h2>แม่แบบแบบตรวจรายเดือน</h2><p>แก้ไขโดยสร้าง Version ใหม่เท่านั้น ประวัติรอบที่ส่งแล้วจะอ้างอิง snapshot เดิม</p></div><button onClick={beginVersion}><Icon name="plus" size={14} />สร้าง Version ใหม่</button></header>
    {error && <p className="mtr-error" role="alert">{error}</p>}{notice && <p className="mtr-notice" role="status">{notice}</p>}
    <nav>{PROFILES.map(item => <button key={item.id} className={profile === item.id ? 'active' : ''} onClick={() => { setProfile(item.id); setEditing(false) }}><b>{item.label}</b><small>{item.note}</small></button>)}</nav>
    <div className="mtr-versions">
      {selected.map(template => <article key={template.id}><span className={template.active ? 'active' : ''}>V{template.version}</span><div><b>{template.titleTh}</b><small>{template.items.length} รายการ · สร้าง {new Date(template.createdAt).toLocaleDateString('th-TH')}{template.active ? ' · ใช้งานอยู่' : ' · inactive/history'}</small></div>{template.active ? <strong>ACTIVE</strong> : <button disabled={busy || (template.profile.endsWith('spill_kit') && !template.items.length)} onClick={() => void activate(template)}>เปิดใช้งาน Version นี้</button>}</article>)}
      {!selected.length && <p>ยังไม่มีแม่แบบ profile นี้</p>}
    </div>
    {editing && <div className="mtr-editor"><h3>สร้าง Version ใหม่: {PROFILES.find(item => item.id === profile)?.label}</h3><label>ชื่อแม่แบบ<input value={title} onChange={event => setTitle(event.target.value)} /></label><label>รายการตรวจ <small>หนึ่งบรรทัดต่อรายการ: item-key | ชื่อรายการ</small><textarea value={lines} onChange={event => setLines(event.target.value)} placeholder="chemical-gloves | ถุงมือป้องกันสารเคมี" /></label><footer><button onClick={() => setEditing(false)}>ยกเลิก</button><button className="primary" disabled={busy || !title.trim() || (profile.endsWith('spill_kit') && !lines.trim())} onClick={() => void create()}>{busy ? 'กำลังสร้าง…' : 'สร้าง Version ใหม่'}</button></footer></div>}
    <style jsx>{`
      .mtr{margin-top:22px;padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--card)}.mtr>header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.mtr>header span{color:var(--primary);font-size:10px;font-weight:900;letter-spacing:.13em}.mtr h2{margin:3px 0;font-size:20px}.mtr p{margin:0;color:var(--muted);font-size:12px}.mtr>header button,.mtr-versions button,.mtr-editor button{min-height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;font-size:11px;font-weight:800}.mtr>header button{display:inline-flex;align-items:center;gap:5px;border-color:var(--primary);background:var(--primary);color:white}.mtr-error,.mtr-notice{margin-top:10px!important;padding:9px;border-radius:7px;background:#fef2f2;color:#b91c1c!important}.mtr-notice{background:#ecfdf5;color:#047857!important}.mtr nav{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:14px}.mtr nav button{display:flex;flex-direction:column;min-height:60px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);text-align:left}.mtr nav button.active{border-color:var(--primary);background:var(--primary-soft)}.mtr nav b{font-size:12px}.mtr nav small{color:var(--muted);font-size:9px}.mtr-versions{margin-top:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden}.mtr-versions article{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:62px;padding:8px 12px;border-bottom:1px solid var(--border)}.mtr-versions article>span{display:grid;place-items:center;min-height:32px;border-radius:6px;background:var(--surface-2);font-weight:900}.mtr-versions article>span.active{background:#d1fae5;color:#047857}.mtr-versions article>div{display:flex;flex-direction:column}.mtr-versions article small{color:var(--muted);font-size:10px}.mtr-versions article>strong{color:#047857;font-size:10px}.mtr-editor{margin-top:10px;padding:14px;border:1px solid var(--primary);border-radius:9px}.mtr-editor h3{margin:0 0 10px}.mtr-editor label{display:flex;flex-direction:column;gap:4px;margin-top:8px;font-size:11px;font-weight:700}.mtr-editor input,.mtr-editor textarea{min-height:44px;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--ink);font:inherit}.mtr-editor textarea{min-height:220px;resize:vertical}.mtr-editor footer{display:flex;justify-content:flex-end;gap:7px;margin-top:10px}.mtr-editor button.primary{border-color:var(--primary);background:var(--primary);color:white}@media(max-width:767px){.mtr{padding:13px}.mtr>header{display:block}.mtr>header button{margin-top:10px}.mtr nav{grid-template-columns:1fr}.mtr-versions article{grid-template-columns:38px minmax(0,1fr)}.mtr-versions article>button,.mtr-versions article>strong{grid-column:2}}
    `}</style>
  </section>
}
