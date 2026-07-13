'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { useUniformBoxHeight } from '@/lib/hooks/useUniformBoxHeight'

export interface StaffOption { id: string; name: string }

interface OrgNodeView {
  id: string
  parent_id: string | null
  title: string
  person_name: string | null
  profile_id: string | null
  photo_url: string | null
  photo_position: string | null
  phone: string | null
  node_type: 'leadership' | 'position' | 'unit'
  is_linkable: boolean
  sort_order: number
  display_name: string | null
  position: string | null
  photo: string | null
}

const TREE_CSS = `
.octree { padding: 16px 0; overflow-x: auto; }
.octree ul { position: relative; padding-top: 22px; display: flex; justify-content: center; margin: 0; }
.octree > ul { padding-top: 0; }
.octree li { list-style: none; position: relative; padding: 22px 10px 0; display: flex; flex-direction: column; align-items: center; }
.octree li::before, .octree li::after {
  content: ''; position: absolute; top: 0; right: 50%;
  border-top: 1.5px solid var(--border); width: 50%; height: 22px;
}
.octree li::after { right: auto; left: 50%; border-left: 1.5px solid var(--border); }
.octree li:only-child::after, .octree li:only-child::before { display: none; }
.octree li:only-child { padding-top: 0; }
.octree li:first-child::before, .octree li:last-child::after { border: 0 none; }
.octree li:last-child::before { border-right: 1.5px solid var(--border); border-radius: 0 6px 0 0; }
.octree li:first-child::after { border-radius: 6px 0 0 0; }
.octree ul ul::before {
  content: ''; position: absolute; top: 0; left: 50%;
  border-left: 1.5px solid var(--border); width: 0; height: 22px;
}
`

export function OrgChartClient({ canEdit, staff }: { canEdit: boolean; staff: StaffOption[] }) {
  const [nodes, setNodes] = useState<OrgNodeView[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<OrgNodeView | null>(null)
  const [addParent, setAddParent] = useState<OrgNodeView | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const boxInnerHeight = useUniformBoxHeight(treeRef, '[data-org-inner]', [nodes])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/personnel/org')
      const json = await res.json()
      setNodes(json.data ?? [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const childrenOf = useMemo(() => {
    const m = new Map<string | null, OrgNodeView[]>()
    for (const n of nodes) {
      const k = n.parent_id
      m.set(k, [...(m.get(k) ?? []), n])
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order)
    return m
  }, [nodes])

  const roots = childrenOf.get(null) ?? []

  function renderNode(n: OrgNodeView): React.ReactNode {
    const kids = childrenOf.get(n.id) ?? []
    return (
      <li key={n.id}>
        <NodeBox node={n} canEdit={canEdit} innerHeight={boxInnerHeight} onEdit={() => setEditing(n)} onAdd={() => setAddParent(n)} />
        {kids.length > 0 && <ul>{kids.map(renderNode)}</ul>}
      </li>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style dangerouslySetInnerHTML={{ __html: TREE_CSS }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/staff/personnel" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}><Icon name="arrowLeft" size={16} /> บุคลากร</Link>
        <div style={{ flex: 1 }}><PageHeader eyebrow="กลุ่มงานเทคนิคการแพทย์" title="ผังองค์กร" subtitle="รพ.ชลบุรี" marginBottom={0} /></div>
        <button onClick={() => window.print()} style={btn}><Icon name="download" size={15} /> พิมพ์</button>
        {canEdit && roots.length === 0 && !loading && (
          <button onClick={() => setAddParent({ id: '', title: '', is_linkable: false } as OrgNodeView)} style={{ ...btn, background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }}><Icon name="plus" size={15} /> เพิ่มกล่องบนสุด</button>
        )}
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลด…</div>
        ) : roots.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>ยังไม่มีผังองค์กร</div>
        ) : (
          <div className="octree" ref={treeRef}><ul>{roots.map(renderNode)}</ul></div>
        )}
      </div>

      {canEdit && <div style={{ fontSize: 12, color: 'var(--muted)' }}>คลิกไอคอนดินสอเพื่อแก้กล่อง/อัปโหลดรูป/link โปรไฟล์ · ไอคอน + เพื่อเพิ่มหน่วยย่อย</div>}

      {editing && (
        <EditNodeModal node={editing} staff={staff} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }} onDeleted={() => { setEditing(null); load() }} />
      )}
      {addParent && (
        <AddNodeModal parent={addParent} onClose={() => setAddParent(null)} onSaved={() => { setAddParent(null); load() }} />
      )}
    </div>
  )
}

const NODE_BOX_V_PADDING = 28 // '14px 12px' top+bottom

function NodeBox({ node, canEdit, innerHeight, onEdit, onAdd }: { node: OrgNodeView; canEdit: boolean; innerHeight?: number; onEdit: () => void; onAdd: () => void }) {
  const accent = node.node_type === 'leadership' ? '#64748B' : node.node_type === 'position' ? 'var(--primary)' : '#0D9488'
  return (
    <div style={{ position: 'relative', width: 188, minHeight: innerHeight !== undefined ? innerHeight + NODE_BOX_V_PADDING : undefined, boxSizing: 'border-box', background: 'var(--card)', border: `1px solid var(--border)`, borderTop: `3px solid ${accent}`, borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div data-org-inner style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 110, height: 110, borderRadius: 9, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
          {node.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={node.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: node.photo_position ?? '50% 50%' }} />
            : <Icon name="users" size={30} />}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.3 }}>{node.title}</div>
        {node.display_name
          ? (node.profile_id
              ? <Link href={`/staff/personnel/${node.profile_id}`} style={{ fontSize: 11.5, color: 'var(--primary)', textDecoration: 'none', textAlign: 'center' }}>{node.display_name}</Link>
              : <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>{node.display_name}</div>)
          : <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>— ว่าง —</div>}
        {node.position && <div style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.3 }}>{node.position}</div>}
        {node.phone && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: '"IBM Plex Mono",monospace', textAlign: 'center' }}>☎ {node.phone}</div>}
      </div>
      {canEdit && (
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 3 }}>
          <button onClick={onEdit} title="แก้ไข" style={miniBtn}><Icon name="edit" size={12} /></button>
          <button onClick={onAdd} title="เพิ่มหน่วยย่อย" style={miniBtn}><Icon name="plus" size={12} /></button>
        </div>
      )}
    </div>
  )
}

function EditNodeModal({ node, staff, onClose, onSaved, onDeleted }: { node: OrgNodeView; staff: StaffOption[]; onClose: () => void; onSaved: () => void; onDeleted: () => void }) {
  const [title, setTitle] = useState(node.title)
  const [personName, setPersonName] = useState(node.person_name ?? '')
  const [profileId, setProfileId] = useState(node.profile_id ?? '')
  const [phone, setPhone] = useState(node.phone ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [photoPosition, setPhotoPosition] = useState(node.photo_position ?? '50% 50%')
  const [previewUrl, setPreviewUrl] = useState<string | null>(node.photo)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!file) { setPreviewUrl(node.photo); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, node.photo])

  async function save() {
    setSaving(true); setErr('')
    try {
      if (file) {
        const fd = new FormData(); fd.append('file', file)
        const up = await fetch(`/api/admin/personnel/org/${node.id}/photo`, { method: 'POST', body: fd })
        if (!up.ok) throw new Error((await up.json()).error ?? 'อัปโหลดรูปไม่สำเร็จ')
      }
      const body = node.is_linkable
        ? { title, phone, profile_id: profileId || null, person_name: profileId ? undefined : personName, photo_position: photoPosition }
        : { title, phone, person_name: personName, photo_position: photoPosition }
      const res = await fetch(`/api/admin/personnel/org/${node.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error ?? 'บันทึกไม่สำเร็จ')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'error') } finally { setSaving(false) }
  }
  async function removePhoto() {
    await fetch(`/api/admin/personnel/org/${node.id}/photo`, { method: 'DELETE' }); onSaved()
  }
  async function del() {
    if (!confirm('ลบกล่องนี้และหน่วยย่อยทั้งหมด?')) return
    await fetch(`/api/admin/personnel/org/${node.id}`, { method: 'DELETE' }); onDeleted()
  }

  return (
    <ModalShell title="แก้ไขกล่องผังองค์กร" onClose={onClose} footer={
      <>
        <button onClick={del} style={{ ...ghostBtn, color: 'var(--danger)', borderColor: 'var(--danger)', marginRight: 'auto' }}><Icon name="trash" size={14} /> ลบ</button>
        <button onClick={onClose} style={ghostBtn}>ยกเลิก</button>
        <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </>
    }>
      <Field label="ชื่อกล่อง"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      {node.is_linkable ? (
        <>
          <Field label="link โปรไฟล์บุคลากร">
            <select style={inputStyle} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">— ไม่ link (กรอกชื่อเอง) —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {!profileId && <Field label="หรือกรอกชื่อบุคคลเอง"><input style={inputStyle} value={personName} onChange={(e) => setPersonName(e.target.value)} /></Field>}
        </>
      ) : (
        <Field label="ชื่อบุคคล (กล่องบนสุด — ไม่ link โปรไฟล์)"><input style={inputStyle} value={personName} onChange={(e) => setPersonName(e.target.value)} /></Field>
      )}
      <Field label="เบอร์โทรภายใน (หลายเบอร์คั่นด้วย ,)"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เช่น 1458 หรือ 1464, 1469" /></Field>
      <Field label="รูป (PNG/JPG/WebP ≤10MB)">
        <ImageDropZone file={file} onFile={setFile} />
        {node.photo && <button onClick={removePhoto} style={{ ...ghostBtn, marginTop: 8, fontSize: 12 }}><Icon name="trash" size={13} /> ลบรูปปัจจุบัน</button>}
      </Field>
      {previewUrl && (
        <Field label="ปรับตำแหน่งรูปในกรอบ">
          <PhotoPositionPicker src={previewUrl} position={photoPosition} onChange={setPhotoPosition} />
        </Field>
      )}
      {err && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{err}</div>}
    </ModalShell>
  )
}

function AddNodeModal({ parent, onClose, onSaved }: { parent: OrgNodeView; onClose: () => void; onSaved: () => void }) {
  const isRoot = !parent.id
  const [title, setTitle] = useState('')
  const [nodeType, setNodeType] = useState<'leadership' | 'position' | 'unit'>(isRoot ? 'leadership' : 'unit')
  const [linkable, setLinkable] = useState(!isRoot)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!title.trim()) { setErr('กรุณากรอกชื่อกล่อง'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/admin/personnel/org', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: isRoot ? null : parent.id, title, node_type: nodeType, is_linkable: linkable }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'เพิ่มไม่สำเร็จ')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : 'error') } finally { setSaving(false) }
  }

  return (
    <ModalShell title={isRoot ? 'เพิ่มกล่องบนสุด' : `เพิ่มหน่วยย่อยใต้ "${parent.title}"`} onClose={onClose} footer={
      <><button onClick={onClose} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'เพิ่ม'}</button></>
    }>
      <Field label="ชื่อกล่อง"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
      <Field label="ประเภท">
        <select style={inputStyle} value={nodeType} onChange={(e) => setNodeType(e.target.value as typeof nodeType)}>
          <option value="leadership">ผู้บริหาร (Leadership)</option>
          <option value="position">ตำแหน่ง (Position)</option>
          <option value="unit">หน่วยงาน (Unit)</option>
        </select>
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
        <input type="checkbox" checked={linkable} onChange={(e) => setLinkable(e.target.checked)} />
        link กับโปรไฟล์ในระบบได้
      </label>
      {err && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{err}</div>}
    </ModalShell>
  )
}

// ── shared modal + styles ──
function ModalShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>{footer}</div>
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

function ImageDropZone({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  function selectFile(next: File | undefined) {
    if (next) onFile(next)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files?.[0]) }}
      style={{
        border: `1.5px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 12,
        background: dragging ? 'var(--primary-soft)' : 'var(--surface-2)',
        padding: '15px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'background .15s, border-color .15s, box-shadow .15s',
        boxShadow: dragging ? '0 0 0 4px var(--primary-soft)' : 'none',
        outline: 'none',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" onChange={(e) => selectFile(e.target.files?.[0])} style={{ display: 'none' }} />
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--card)', color: file ? 'var(--success)' : 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={file ? 'check' : 'upload'} size={18} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : 'ลากรูปมาวาง หรือคลิกเพื่อเลือกไฟล์'}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
          {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'รองรับ PNG, JPG, WebP ขนาดไม่เกิน 10MB'}
        </div>
      </div>
      {file && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFile(null) }}
          style={{ ...miniBtn, color: 'var(--danger)' }}
          aria-label="ล้างไฟล์"
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  )
}

function parsePhotoPosition(pos: string): [number, number] {
  const m = pos.match(/^(\d{1,3})%\s+(\d{1,3})%$/)
  return m ? [Number(m[1]), Number(m[2])] : [50, 50]
}

function PhotoPositionPicker({ src, position, onChange }: { src: string; position: string; onChange: (pos: string) => void }) {
  const [x, y] = parsePhotoPosition(position)
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ width: 96, height: 96, borderRadius: 9, overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%` }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <label style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
          แนวนอน
          <input type="range" min={0} max={100} value={x} onChange={(e) => onChange(`${e.target.value}% ${y}%`)} style={{ width: '100%', display: 'block' }} />
        </label>
        <label style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
          แนวตั้ง
          <input type="range" min={0} max={100} value={y} onChange={(e) => onChange(`${x}% ${e.target.value}%`)} style={{ width: '100%', display: 'block' }} />
        </label>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const miniBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
