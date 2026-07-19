import Link from 'next/link'
import type { ExternalQualityAlertsData } from '@/lib/external-quality/dashboard'

const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

export function ExternalQualityAlerts({ data }: { data: ExternalQualityAlertsData }) {
  if (!data.available) return null
  return <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><strong>OUTLAB · ใบรับรอง</strong><div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{data.outlab.expiring} ใกล้หมดอายุ · {data.outlab.expired} หมดอายุ · {data.outlab.missing} ไม่มีใบปัจจุบัน</div></div><Link href="/staff/outlab/certificates?filter=expiring" style={{ fontSize: 12, fontWeight: 700 }}>เปิดทะเบียน →</Link></div>
      <div style={{ padding: '8px 16px' }}>{data.outlab.items.length ? data.outlab.items.map(item => <Link key={item.id} href={`/staff/outlab/certificates?filter=${item.urgency === 'expired' ? 'expired' : 'expiring'}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)', fontSize: 12 }}><span><strong>{item.laboratory}</strong><br /><span style={{ color: 'var(--muted)' }}>{item.standard}</span></span><span style={{ color: item.urgency === 'expired' ? '#DC2626' : '#B45309', whiteSpace: 'nowrap' }}>{fmt(item.expiresOn)}</span></Link>) : <p style={{ color: 'var(--muted)', fontSize: 12 }}>ไม่มีใบรับรองที่ต้องติดตาม</p>}</div>
    </div>
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><strong>EQA · รอบและ CAPA</strong><div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{data.eqa.due} ใกล้ส่ง · {data.eqa.overdue} เกินกำหนด · {data.eqa.unacceptable} ผลไม่ผ่าน · {data.eqa.openCapas} CAPA ค้าง</div></div><Link href="/staff/eqa" style={{ fontSize: 12, fontWeight: 700 }}>เปิด EQA →</Link></div>
      <div style={{ padding: '8px 16px' }}>{data.eqa.items.length ? data.eqa.items.map(item => <Link key={item.id} href="/staff/eqa" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)', fontSize: 12 }}><span>{item.name}</span><span style={{ color: item.urgency === 'overdue' ? '#DC2626' : '#B45309', whiteSpace: 'nowrap' }}>{fmt(item.dueOn)}</span></Link>) : <p style={{ color: 'var(--muted)', fontSize: 12 }}>ไม่มีรอบที่ต้องติดตาม</p>}</div>
    </div>
  </section>
}
