'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { Card } from '@/components/ui/Card'

type Task = any
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit' }
const primaryBtn: React.CSSProperties = { border: 0, borderRadius: 8, background: 'var(--primary)', color: '#fff', padding: '9px 14px', font: 'inherit', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const ghostBtn: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', padding: '8px 12px', font: 'inherit', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }

export function AgreementSignatureCanvas({ onChange }: { onChange: (file: File | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }
  }
  const emit = () => canvasRef.current?.toBlob((blob) => onChange(blob ? new File([blob], 'agreement-signature.png', { type: 'image/png' }) : null), 'image/png')
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!; const p = point(event)
    drawing.current = true; canvas.setPointerCapture(event.pointerId); ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!; const p = point(event)
    ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); setHasInk(true)
  }
  const end = () => { if (!drawing.current) return; drawing.current = false; emit() }
  const clear = () => { const canvas = canvasRef.current!; canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height); setHasInk(false); onChange(null) }
  return <div>
    <canvas ref={canvasRef} width={900} height={260} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ width: '100%', height: 150, border: '1px dashed var(--border)', borderRadius: 9, touchAction: 'none', background: '#fff', cursor: 'crosshair' }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--muted)' }}><span>วาดลายมือชื่อในกรอบ</span>{hasInk && <button type="button" onClick={clear} style={{ ...ghostBtn, padding: '3px 8px', fontSize: 11 }}>ล้าง</button>}</div>
  </div>
}

export function AnnualAgreementsClient() {
  const [task, setTask] = useState<Task | null | undefined>(undefined)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [hasActivity, setHasActivity] = useState(false)
  const [activityName, setActivityName] = useState('')
  const [activityDate, setActivityDate] = useState('')
  const [place, setPlace] = useState('')
  const [impacts, setImpacts] = useState<string[]>([])
  const [impactNotes, setImpactNotes] = useState('')
  const [method, setMethod] = useState<'drawn' | 'saved'>('drawn')
  const [signature, setSignature] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => fetch('/api/me/annual-agreements').then((r) => r.json()).then((j) => { setTask(j.task ?? null); if (j.error) setMessage(j.error) }).catch(() => { setTask(null); setMessage('ไม่สามารถเชื่อมต่อระบบข้อตกลงได้') })
  useEffect(() => { load() }, [])
  const toggleImpact = (impact: string) => setImpacts((current) => current.includes(impact) ? current.filter((value) => value !== impact) : [...current, impact])
  const campaign = task?.campaign
  const recipient = task?.recipient
  const done = recipient?.status === 'completed' || recipient?.status === 'certified'

  async function saveOfficialSignature() {
    if (!signature) return false
    const fd = new FormData(); fd.append('file', signature)
    const res = await fetch('/api/me/signature', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { setMessage(data.error ?? 'บันทึกลายเซ็นทางการไม่สำเร็จ'); return false }
    const nextSignature = { signature_url: data.signature_url, signed_url: data.signature_signed_url }
    setTask((current: Task | null | undefined) => current ? { ...current, savedSignature: nextSignature } : current)
    return true
  }

  async function submit() {
    if (!agreementAccepted) return setMessage('กรุณายอมรับข้อตกลงรักษาความลับและความเป็นกลาง')
    if (method === 'saved' && !task?.savedSignature) return setMessage('ยังไม่มีลายเซ็นทางการที่บันทึกไว้')
    if (method === 'drawn' && !signature) return setMessage('กรุณาวาดลายมือชื่อก่อนลงนาม')
    setSaving(true); setMessage(null)
    if (method === 'drawn' && signature && window.confirm('ต้องการเก็บลายเซ็นนี้ไว้ใช้ครั้งหน้าหรือไม่?\nลายเซ็นจะถูกบันทึกเป็นลายเซ็นทางการในหน้าโปรไฟล์ของคุณ')) {
      if (!(await saveOfficialSignature())) { setSaving(false); return }
    }
    const fd = new FormData()
    fd.append('signingMethod', method)
    fd.append('disclosure', JSON.stringify({ hasActivity, activityName, activityDate, place, impacts, impactNotes }))
    if (method === 'drawn' && signature) fd.append('signature', signature)
    const res = await fetch(`/api/me/annual-agreements/${campaign.id}/submit`, { method: 'POST', body: fd })
    const data = await res.json(); setSaving(false)
    if (!res.ok) return setMessage(data.error ?? 'ลงนามไม่สำเร็จ')
    setMessage('ลงนามและสร้างหลักฐานเรียบร้อยแล้ว'); load()
  }

  if (task === undefined) return <div style={{ color: 'var(--muted)', padding: 24 }}>กำลังตรวจงานข้อตกลง…</div>
  if (!task) return <Card padding={24}><div style={{ fontSize: 16, fontWeight: 700 }}>ไม่มีงานข้อตกลงที่เปิดอยู่</div><div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>เมื่อผู้จัดการเปิดรอบประจำปี ระบบจะแสดงงานของคุณที่หน้านี้</div><Link href="/staff/profile" style={{ ...ghostBtn, textDecoration: 'none', marginTop: 14 }}><Icon name="edit" size={14} /> จัดการลายเซ็นทางการในโปรไฟล์</Link></Card>

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Link href="/staff/personnel" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="arrowLeft" size={15} /> บุคลากร</Link><span style={{ color: 'var(--border)' }}>|</span><span style={{ fontSize: 13, color: 'var(--muted)' }}>ข้อตกลงประจำปี</span></div>
    <Card padding={22}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><span style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: 9, borderRadius: 10 }}><Icon name="shieldCheck" size={20} /></span><div><div style={{ fontWeight: 750, fontSize: 18 }}>{campaign.title}</div><div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 13 }}>ปีงบประมาณ พ.ศ. {campaign.fiscal_year} · กำหนดส่ง {new Date(campaign.due_on).toLocaleDateString('th-TH')}</div></div></div>
      {done && <div style={{ marginTop: 16, padding: 12, color: 'var(--success)', background: 'rgba(22,163,74,.08)', borderRadius: 8, fontWeight: 650 }}>ดำเนินการครบแล้วเมื่อ {new Date(recipient.completed_at).toLocaleString('th-TH')} <a href={`/api/me/annual-agreements/${campaign.id}/evidence`} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>ดูหลักฐาน PDF</a><Link href={`/staff/personnel/${recipient.profile_id}?section=agreements`} style={{ marginLeft: 12, color: 'var(--primary)', textDecoration: 'none' }}>ดูในโปรไฟล์</Link></div>}
      {recipient.status === 'exempt' && <div style={{ marginTop: 16, padding: 12, color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 8 }}>ได้รับการยกเว้น: {recipient.exempt_reason}</div>}
    </Card>
    {!done && recipient.status === 'pending' && <>
      <Card padding={22}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>1. ข้อตกลงรักษาความลับและความเป็นกลาง</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>ข้าพเจ้าอ่านและยอมรับเอกสาร {campaign.agreement_document_snapshot.code} เรื่อง {campaign.agreement_document_snapshot.title} ฉบับแก้ไข {campaign.agreement_document_snapshot.revision || '-'} (รหัสตรวจสอบ {String(campaign.agreement_document_snapshot.sha256).slice(0, 16)}…)</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 600, fontSize: 13 }}><input type="checkbox" checked={agreementAccepted} onChange={(e) => setAgreementAccepted(e.target.checked)} /> ข้าพเจ้ายอมรับข้อตกลงรักษาความลับและความเป็นกลาง</label>
      </Card>
      <Card padding={22}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>2. การเปิดเผยกิจกรรม</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>อ้างอิง {campaign.disclosure_document_snapshot.code} · มีงาน/กิจกรรมที่อาจกระทบความเป็นกลางหรือไม่</p>
        <div style={{ display: 'flex', gap: 18, marginBottom: 14, fontSize: 13 }}><label><input type="radio" checked={!hasActivity} onChange={() => setHasActivity(false)} /> ไม่มี</label><label><input type="radio" checked={hasActivity} onChange={() => setHasActivity(true)} /> มี และขอเปิดเผย</label></div>
        {hasActivity && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ gridColumn: '1 / -1', fontSize: 12.5, fontWeight: 650 }}>ชื่อกิจกรรม<input style={{ ...inputStyle, marginTop: 4 }} value={activityName} onChange={(e) => setActivityName(e.target.value)} /></label>
          <label style={{ fontSize: 12.5, fontWeight: 650 }}>วันเวลา<input style={{ ...inputStyle, marginTop: 4 }} value={activityDate} onChange={(e) => setActivityDate(e.target.value)} placeholder="เช่น 15 พ.ย. 2569" /></label>
          <label style={{ fontSize: 12.5, fontWeight: 650 }}>สถานที่<input style={{ ...inputStyle, marginTop: 4 }} value={place} onChange={(e) => setPlace(e.target.value)} /></label>
          <div style={{ gridColumn: '1 / -1', fontSize: 12.5, fontWeight: 650 }}>ผลกระทบที่อาจเกิดขึ้น<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6, fontWeight: 400 }}>{[['ability','ความสามารถ'],['integrity','ความซื่อสัตย์'],['fairness','ความเป็นธรรม'],['decision','การตัดสินใจ']].map(([id, label]) => <label key={id}><input type="checkbox" checked={impacts.includes(id)} onChange={() => toggleImpact(id)} /> {label}</label>)}</div></div>
          <label style={{ gridColumn: '1 / -1', fontSize: 12.5, fontWeight: 650 }}>รายละเอียดเพิ่มเติม (ถ้ามี)<textarea style={{ ...inputStyle, marginTop: 4, minHeight: 70 }} value={impactNotes} onChange={(e) => setImpactNotes(e.target.value)} /></label>
        </div>}
      </Card>
      <Card padding={22}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>ลงนาม</h2>
        <div style={{ display: 'flex', gap: 9, marginBottom: 12, flexWrap: 'wrap' }}><button onClick={() => setMethod('drawn')} style={{ ...ghostBtn, borderColor: method === 'drawn' ? 'var(--primary)' : 'var(--border)', color: method === 'drawn' ? 'var(--primary)' : 'var(--ink)' }}>วาดลายมือชื่อใหม่</button><button onClick={() => setMethod('saved')} disabled={!task.savedSignature} style={{ ...ghostBtn, borderColor: method === 'saved' ? 'var(--primary)' : 'var(--border)', color: method === 'saved' ? 'var(--primary)' : 'var(--ink)', opacity: task.savedSignature ? 1 : .55 }}>ใช้ลายเซ็นทางการ</button></div>
        {method === 'drawn' ? <><AgreementSignatureCanvas onChange={setSignature} /><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>เมื่อกดยืนยัน ระบบจะถามว่าต้องการเก็บลายเซ็นนี้เป็นลายเซ็นทางการเพื่อใช้ครั้งต่อไปหรือไม่</div></> : <div style={{ fontSize: 13, color: 'var(--success)' }}>จะคัดลอกลายเซ็นทางการไปเก็บกับหลักฐานของรอบนี้โดยเฉพาะ</div>}
      </Card>
      {message && <div style={{ color: message.includes('เรียบร้อย') || message.includes('บันทึก') ? 'var(--success)' : 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{message}</div>}
      <div><button onClick={submit} disabled={saving} style={primaryBtn}><Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'ยืนยันและลงนามข้อตกลงประจำปี'}</button></div>
    </>}
  </div>
}
