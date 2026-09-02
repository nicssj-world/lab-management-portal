import React, { useState } from 'react'
import { H3, Callout, Th, TblRow } from '../../_primitives'
import { CONTAINERS, type Container, type Lang } from '../../data'
import { CONTAINER_DETAILS, ORDER_OF_DRAW, PATIENT_PREP, SITES_TO_AVOID } from '../collection-data'
import { useManualTable } from '../../ManualTablesContext'
import { ManualTableEditor } from '@/components/manual/ManualTableEditor'
import { TABLE_SCHEMAS, type EditableRow } from '../../tables'

interface Props { lang: Lang }

export function CollectionOverview({ lang }: Props) {
  const [editing, setEditing] = useState(false)
  const containers = useManualTable<Container>('containers', 'collection', CONTAINERS)
  const rows = containers.rows.map((row, index) => ({
    row: row as Container,
    detail: CONTAINER_DETAILS[index],
    index,
  }))

  return (
    <div>
      <style>{`
        .collection-container-cards { display: none; }
        @media (max-width: 760px) {
          .collection-container-table-wrap { display: none; }
          .collection-container-cards { display: grid; gap: 9px; margin-bottom: 20px; }
          .collection-container-card { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); }
          .collection-container-card dl { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 7px 10px; margin: 11px 0 0; }
          .collection-container-card dt { color: var(--muted); font-size: 10.5px; font-weight: 800; line-height: 1.5; }
          .collection-container-card dd { margin: 0; color: var(--ink); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
        }
      `}</style>

      <div style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 9, marginBottom: 16 }}>
        <div style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }}><span aria-hidden="true" style={{ display: 'block', width: 18, height: 18, border: '2px solid currentColor', borderRadius: 4, position: 'relative' }}><span style={{ position: 'absolute', left: 3, right: 3, bottom: 3, height: 2, background: 'currentColor' }} /></span></div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
            {lang === 'th'
            ? 'สิ่งตัวอย่างส่งตรวจจากผู้ป่วยหรือผู้ตรวจสุขภาพ ได้แก่ เลือด ปัสสาวะ อุจจาระ เสมหะ หนอง และสารน้ำต่าง ๆ ในร่างกาย การเลือกภาชนะ ปริมาตร และวิธีเก็บต้องสอดคล้องกับรายการตรวจ'
              : 'Specimens from patients or health-check participants include blood, urine, stool, sputum, pus, and body fluids. Container, volume, and collection method must match the requested test.'}
          </p>
        </div>
      </div>

      {/* ID notice */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 9, marginBottom: 20 }}>
        <div style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} aria-hidden="true"><span style={{ display: 'block', width: 18, height: 18, border: '2px solid currentColor', borderRadius: 4, position: 'relative' }}><span style={{ position: 'absolute', left: 3, right: 3, top: 5, height: 2, background: 'currentColor' }} /><span style={{ position: 'absolute', left: 3, right: 6, top: 10, height: 2, background: 'currentColor' }} /></span></div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
          {lang === 'th'
            ? 'การชี้บ่งตัวผู้ป่วยโดย (1) ถามชื่อ-นามสกุล และ (2) วันเดือนปีเกิดผู้ป่วย โดยให้ผู้ป่วยเป็นผู้ตอบเองทุกครั้งก่อนเจาะเลือด ตรวจสอบชนิดของหลอดเก็บตัวอย่างเลือดให้ตรงกับรายการทดสอบตามคำสั่งแพทย์ และตรวจสอบสติ๊กเกอร์ที่ติดหลอดเก็บตัวอย่างเลือดว่ามีชื่อ–นามสกุลผู้ป่วย วันเดือนปีเกิด หรือ HN. ตรงกันหรือไม่'
            : 'Identify the patient by asking (1) the name and surname and (2) the date of birth, with the patient answering for themselves before every draw. Confirm that the tube type matches the ordered test and that the patient name, date of birth, or HN on the label matches.'}
        </p>
      </div>

      {/* Order of Draw — keep this sequence unchanged. */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ลำดับการใส่เลือดลงในหลอด (Order of Draw)' : 'Order of Draw'}
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'nowrap', padding: '12px 8px', background: 'var(--surface-2)', borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        {ORDER_OF_DRAW.map((t, i) => (
          <React.Fragment key={t.cap}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '1 1 0', minWidth: 0 }}>
              <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 900, color: '#fff', zIndex: 1 }}>
                {t.num}
              </div>
              <div style={{ marginTop: 22, width: 16, height: 46, borderRadius: 4, background: `linear-gradient(180deg, ${t.color} 28%, #fff 28%, #f3f4f6 100%)`, border: '1px solid rgba(0,0,0,.1)' }} />
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', whiteSpace: 'nowrap' }}>{t.cap}</div>
              <div style={{ fontSize: 9.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{t.name}</div>
            </div>
            {i < ORDER_OF_DRAW.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 38, flexShrink: 0, color: 'var(--muted)', fontSize: 22 }}>›</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Containers table */}
      <H3 mt={0}>{lang === 'th' ? 'ข้อแนะนำการใช้ภาชนะในการจัดเก็บสิ่งตัวอย่างส่งตรวจ' : 'Specimen Container Reference'}</H3>
      <p style={{ margin: '-2px 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
        {lang === 'th'
          ? 'รายละเอียดด้านล่างถอดจากตารางภาชนะในคู่มือ การเบิกใช้ให้ติดต่อจุดเบิกที่ระบุ และตรวจสอบฉลาก/ขีดปริมาตรบนภาชนะทุกครั้ง'
          : 'The details below are transcribed from the manual container table. Use the listed requisition point and verify the label and volume line on every container.'}
      </p>
      {containers.canEdit && !editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button onClick={() => setEditing(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            แก้ตาราง
          </button>
        </div>
      )}
      {editing ? (
        <ManualTableEditor schema={TABLE_SCHEMAS.containers} rows={containers.rows as unknown as EditableRow[]}
          onSaved={nextRows => { containers.setRows(nextRows as unknown as Container[]); setEditing(false) }}
          onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="collection-container-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <Th>{lang === 'th' ? 'ลำดับ' : 'No.'}</Th>
                  <Th>{lang === 'th' ? 'ภาชนะ / สีฝา' : 'Container / Cap'}</Th>
                  <Th>{lang === 'th' ? 'ปริมาตร' : 'Volume'}</Th>
                  <Th>{lang === 'th' ? 'สารในหลอด / การจัดการ' : 'Contents / Handling'}</Th>
                  <Th>{lang === 'th' ? 'การตรวจที่เหมาะสม' : 'Suitable tests'}</Th>
                  <Th>{lang === 'th' ? 'จุดเบิก' : 'Requisition'}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row, detail, index }) => (
                  <TblRow key={`${row.cap}-${index}`}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{index + 1}</td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 145 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 8, height: 22, borderRadius: 3, background: `linear-gradient(180deg, ${row.color} 28%, #f3f4f6 28%)`, border: '1px solid rgba(0,0,0,.08)', flexShrink: 0 }} />
                            <strong style={{ fontSize: 12.5, lineHeight: 1.45 }}>{row.cap}</strong>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top', lineHeight: 1.6, minWidth: 125 }}>{detail?.volume[lang] ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top', lineHeight: 1.6, minWidth: 245 }}>
                      <strong style={{ display: 'block', fontSize: 12 }}>{detail?.contents[lang] ?? row.use}</strong>
                      {detail && <span style={{ display: 'block', marginTop: 4, color: 'var(--muted)', fontSize: 11.5 }}>{detail.handling[lang]}</span>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top', lineHeight: 1.6, minWidth: 220 }}>{detail?.tests[lang] ?? row.use}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12, verticalAlign: 'top' }}>{row.req}</td>
                  </TblRow>
                ))}
              </tbody>
            </table>
          </div>
          <div className="collection-container-cards">
            {rows.map(({ row, detail, index }) => (
              <article key={`${row.cap}-card-${index}`} className="collection-container-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--muted)', fontSize: 10.5, fontWeight: 800, marginBottom: 2 }}>{lang === 'th' ? `รายการที่ ${index + 1}` : `Item ${index + 1}`}</div>
                    <strong style={{ color: 'var(--ink)', fontSize: 13, lineHeight: 1.45 }}>{row.cap}</strong>
                  </div>
                </div>
                <dl>
                  <dt>{lang === 'th' ? 'ปริมาตร' : 'Volume'}</dt><dd>{detail?.volume[lang] ?? '—'}</dd>
                  <dt>{lang === 'th' ? 'สารในหลอด' : 'Contents'}</dt><dd>{detail?.contents[lang] ?? row.use}</dd>
                  <dt>{lang === 'th' ? 'การจัดการ' : 'Handling'}</dt><dd>{detail?.handling[lang] ?? '—'}</dd>
                  <dt>{lang === 'th' ? 'การตรวจ' : 'Tests'}</dt><dd>{detail?.tests[lang] ?? row.use}</dd>
                  <dt>{lang === 'th' ? 'จุดเบิก' : 'Requisition'}</dt><dd>{row.req}</dd>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Sites to avoid */}
      <H3 mt={0}>{lang === 'th' ? 'ตำแหน่งที่ควรหลีกเลี่ยงในการเจาะเลือด' : 'Venipuncture Sites to Avoid'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {SITES_TO_AVOID.map((site, index) => (
          <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 13px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.18)', borderRadius: 8 }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, color: '#fff', fontSize: 12, fontWeight: 800 }}>×</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{lang === 'th' ? site.th : site.en}</span>
          </div>
        ))}
      </div>

      {/* Patient prep */}
      <H3 mt={0}>{lang === 'th' ? 'การเตรียมผู้ป่วยตามรายการตรวจ' : 'Patient Preparation by Test'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 9, marginBottom: 16 }}>
        {PATIENT_PREP.map(prep => (
          <article key={prep.en} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.45 }}>{lang === 'th' ? prep.th : prep.en}</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{lang === 'th' ? prep.en : prep.th}</div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.65 }}>{lang === 'th' ? prep.prepTh : prep.prepEn}</div>
            <ul style={{ margin: '7px 0 0', paddingLeft: 18, color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.6 }}>
              {(lang === 'th' ? prep.detailsTh : prep.detailsEn).map((detail, index) => <li key={index}>{detail}</li>)}
            </ul>
          </article>
        ))}
      </div>

      <Callout tone="danger" icon="biohazard">
        {lang === 'th'
          ? 'หลอด Sodium citrate (จุกฟ้า) ต้องใส่เลือดให้ถึงขีดข้างหลอดพอดี — ห้ามขาดหรือเกิน หาก Hct > 55% หรือ < 20% ให้แจ้งห้องปฏิบัติการก่อนเจาะเพื่อปรับปริมาณสารกันเลือดแข็ง'
          : 'Sodium citrate tubes (blue cap) must fill exactly to the indicator line — never under or over. If Hct > 55% or < 20%, notify the lab before collection so the anticoagulant volume can be adjusted.'}
      </Callout>

      <Callout tone="warning" icon="alert">
        {lang === 'th'
          ? 'ห้ามรัดแขนผู้ป่วยเกิน 2 นาที · ห้ามดัน Syringe เมื่อใส่เลือดลงหลอด เพราะเสี่ยง Hemolysis · ใช้ one-hand technique โดยวางหลอดใน rack'
          : 'Do not leave the tourniquet on for more than 2 min. Never push syringe blood into a tube because of hemolysis risk. Use one-hand technique with the tube in a rack.'}
      </Callout>
    </div>
  )
}
