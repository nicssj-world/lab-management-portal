import React from 'react'
import { H3, Callout, Th, TblRow } from '../../_primitives'
import { CONTAINERS, type Lang } from '../../data'
import { ORDER_OF_DRAW, SITES_TO_AVOID, PATIENT_PREP } from '../collection-data'

interface Props { lang: Lang }

export function CollectionOverview({ lang }: Props) {
  return (
    <div>
      {/* ID notice */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 9, marginBottom: 20 }}>
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>🪪</span>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
          {lang === 'th'
            ? 'การชี้บ่งตัวผู้ป่วยใช้อย่างน้อย 2 รายการ คือ (1) ชื่อ-นามสกุล และ (2) วันเดือนปีเกิด หรือ HN. ห้ามติดสติ๊กเกอร์หลอดล่วงหน้า ต้องตรวจสอบให้ตรงกับใบนำส่งทุกครั้งก่อนเจาะ'
            : 'Use at least 2 identifiers — (1) full name and (2) DOB or HN. Never pre-label tubes; verify against the request form before every venipuncture.'}
        </p>
      </div>

      {/* Order of draw */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ลำดับการใส่เลือดลงในหลอด (Order of Draw)' : 'Order of Draw'}
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '12px 8px', background: 'var(--surface-2)', borderRadius: 10, overflowX: 'auto', marginBottom: 20 }}>
        {ORDER_OF_DRAW.map((t, i) => (
          <React.Fragment key={t.cap}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, minWidth: 70 }}>
              <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 900, color: '#fff', zIndex: 1 }}>
                {t.num}
              </div>
              <div style={{ marginTop: 22, width: 18, height: 50, borderRadius: 4, background: `linear-gradient(180deg, ${t.color} 28%, #fff 28%, #f3f4f6 100%)`, border: '1px solid rgba(0,0,0,.1)' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>{t.cap}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.35 }}>{t.name}</div>
            </div>
            {i < ORDER_OF_DRAW.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 38, flexShrink: 0, color: 'var(--muted)', fontSize: 22 }}>›</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Containers table */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ภาชนะสำหรับเก็บสิ่งตัวอย่างส่งตรวจ' : 'Specimen Containers Reference'}
      </h3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 480, overflowY: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
              <Th>{lang === 'th' ? 'ภาชนะ / สีฝา' : 'Container / Cap'}</Th>
              <Th>{lang === 'th' ? 'การใช้งานหลัก' : 'Primary Use'}</Th>
              <Th>{lang === 'th' ? 'จุดเบิก' : 'Requisition'}</Th>
            </tr>
          </thead>
          <tbody>
            {CONTAINERS.map((c) => (
              <TblRow key={c.cap}>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 22, borderRadius: 3, background: `linear-gradient(180deg, ${c.color} 28%, #f3f4f6 28%)`, border: '1px solid rgba(0,0,0,.08)', flexShrink: 0 }} />
                    <strong style={{ fontSize: 12.5 }}>{c.cap}</strong>
                  </span>
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--ink)', fontSize: 12.5 }}>{c.use}</td>
                <td style={{ padding: '9px 12px', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{c.req}</td>
              </TblRow>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sites to avoid */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ตำแหน่งที่ควรหลีกเลี่ยงในการเจาะเลือด' : 'Venipuncture Sites to Avoid'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {SITES_TO_AVOID.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 13px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.18)', borderRadius: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✕</span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{lang === 'th' ? s.th : s.en}</span>
          </div>
        ))}
      </div>

      {/* Patient prep */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'การเตรียมผู้ป่วยตามรายการตรวจ' : 'Patient Preparation by Test'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {PATIENT_PREP.map((p) => (
          <div key={p.en} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 1 }}>{lang === 'th' ? p.th : p.en}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{lang === 'th' ? p.en : p.th}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>{lang === 'th' ? p.prepTh : p.prepEn}</div>
          </div>
        ))}
      </div>

      <Callout tone="danger" icon="biohazard">
        {lang === 'th'
          ? 'หลอด Sodium citrate (จุกฟ้า) ต้องใส่เลือดให้ถึงขีดข้างหลอดพอดี — ห้ามขาดหรือเกินโดยเด็ดขาด หาก Hct > 55% หรือ < 20% ให้แจ้งห้องปฏิบัติการก่อนเจาะเพื่อปรับสารกันเลือดแข็ง'
          : 'Sodium citrate tubes (blue cap) MUST fill exactly to the indicator line — never under or over. If Hct > 55% or < 20%, notify the lab BEFORE collection so the anticoagulant ratio can be adjusted.'}
      </Callout>

      <Callout tone="warning" icon="alert">
        {lang === 'th'
          ? 'ห้ามรัดแขนผู้ป่วยเกิน 2 นาที — ค่าตรวจหลายรายการจะเปลี่ยนแปลง · ห้ามดัน Syringe เมื่อใส่เลือดลงหลอด (เสี่ยง Hemolysis) · ใช้ one-hand technique โดยวางหลอดใน rack'
          : 'Tourniquet ≤ 2 min — longer values shift many analytes. Do not push the syringe plunger into the tube (hemolysis risk). Use one-hand technique with the tube in a rack.'}
      </Callout>
    </div>
  )
}
