import { useState } from 'react'
import { H2, Section } from '../_primitives'
import { type Lang } from '../data'
import { useManualTable } from '../ManualTablesContext'
import { ManualTableEditor } from '@/components/manual/ManualTableEditor'
import { TABLE_SCHEMAS, type EditableRow } from '../tables'

interface Props { lang: Lang }

// ── Data ─────────────────────────────────────────────────────────────────────

interface Step {
  roleTh: string; roleEn: string
  roleColor: string; roleBg: string
  th: string; en: string
}
const STEPS: Step[] = [
  {
    roleTh: 'แพทย์ / พยาบาล', roleEn: 'Physician / Nurse',
    roleColor: 'var(--primary)', roleBg: 'var(--primary-soft)',
    th: 'โทรประสานกับนักเทคนิคการแพทย์ของแต่ละงาน เพื่อประเมินว่าสิ่งตัวอย่างเดิมยังสามารถตรวจวิเคราะห์ซ้ำหรือเพิ่มรายการได้',
    en: 'Phone the MT in the relevant section to confirm the residual specimen is still viable for the add-on or repeat.',
  },
  {
    roleTh: 'นักเทคนิคการแพทย์', roleEn: 'Medical Technologist',
    roleColor: '#0891B2', roleBg: 'rgba(8,145,178,.09)',
    th: 'ประเมินสภาพตัวอย่างและบันทึกในแบบบันทึกการขอเพิ่มการตรวจวิเคราะห์ทางโทรศัพท์ (Fm-WI-G-OV02/01)',
    en: 'Evaluate specimen quality and log the request on form Fm-WI-G-OV02/01 (Add-on Request — phone log).',
  },
  {
    roleTh: 'แพทย์ / พยาบาล / เจ้าหน้าที่หอผู้ป่วย', roleEn: 'Physician / Nurse / Ward Staff',
    roleColor: '#7C3AED', roleBg: 'rgba(124,58,237,.09)',
    th: 'บันทึกรายการตรวจเพิ่มในระบบ HIS',
    en: 'Enter the add-on test in HIS.',
  },
  {
    roleTh: 'เจ้าหน้าที่ LAB', roleEn: 'Lab Staff',
    roleColor: '#D97706', roleBg: 'rgba(217,119,6,.09)',
    th: 'ลงทะเบียนรับและ print barcode LAB no. ใหม่ ติดที่ภาชนะเดิม — ห้ามทับ barcode เดิม',
    en: 'Register and print a new LAB no. barcode for the existing container — do NOT cover the original barcode.',
  },
  {
    roleTh: 'นักเทคนิคการแพทย์', roleEn: 'Medical Technologist',
    roleColor: 'var(--success)', roleBg: 'rgba(22,163,74,.09)',
    th: 'ดำเนินการตรวจและรายงานผลผ่าน LIS / HIS — แพทย์ดูผลได้ทันที',
    en: 'Run the analysis and report via LIS / HIS — physician sees the result immediately.',
  },
]

interface AddonLimitItem {
  sectionTh: string; sectionEn: string
  examplesTh?: string; examplesEn?: string
  limitTh: string; limitEn: string
  emoji: string
}
const ADDON_LIMITS: AddonLimitItem[] = [
  {
    sectionTh: 'จุลทรรศนศาสตร์คลินิก', sectionEn: 'Clinical Microscopy',
    examplesTh: 'เพิ่มรายการตรวจวิเคราะห์ เช่น Occult Blood, Urine Pregnancy test, การตรวจปัสสาวะหาสารเสพติด เป็นต้น',
    examplesEn: 'Add-on e.g. Occult Blood, Urine Pregnancy test, urine drug screening',
    limitTh: 'ภายในระยะเวลาไม่เกิน 1 ชั่วโมงนับจากระยะเวลารับสิ่งส่งตรวจ', limitEn: 'Within 1 hour of specimen receipt',
    emoji: '🔬',
  },
  {
    sectionTh: 'เคมีคลินิก', sectionEn: 'Clinical Chemistry',
    examplesTh: 'เพิ่มรายการตรวจวิเคราะห์ เช่น Glucose, BUN, Creatinine, Electrolyte, Lactate, LFT, Thyriod hormone, Troponin-T, NT-proNT เป็นต้น',
    examplesEn: 'Add-on e.g. Glucose, BUN, Creatinine, Electrolyte, Lactate, LFT, Thyroid hormone, Troponin-T, NT-proBNP',
    limitTh: 'ภายในระยะเวลาไม่เกิน 2 ชั่วโมงนับจากระยะเวลารับสิ่งส่งตรวจ', limitEn: 'Within 2 hours of specimen receipt',
    emoji: '⚗️',
  },
  {
    sectionTh: 'ภูมิคุ้มกันวิทยาคลินิก', sectionEn: 'Immunology',
    examplesTh: 'เพิ่มรายการตรวจวิเคราะห์ เช่น Anti-HIV, Anti HCV, HBs Ag, Anti-HBs, Anti HBc, Troponin I, Procalcitonin เป็นต้น',
    examplesEn: 'Add-on e.g. Anti-HIV, Anti-HCV, HBsAg, Anti-HBs, Anti-HBc, Troponin I, Procalcitonin',
    limitTh: 'ภายในระยะเวลาไม่เกิน 6 ชั่วโมงนับจากระยะเวลารับสิ่งส่งตรวจ', limitEn: 'Within 6 hours of specimen receipt',
    emoji: '🛡️',
  },
  {
    sectionTh: 'โลหิตวิทยาคลินิก', sectionEn: 'Hematology',
    examplesTh: 'เพิ่มรายการตรวจวิเคราะห์ เช่น CBC, PT INR, PTT, Reticulocyte count, ESR, ขอไถสไลด์ Blood Smear เป็นต้น',
    examplesEn: 'Add-on e.g. CBC, PT/INR, PTT, Reticulocyte count, ESR, Blood Smear review',
    limitTh: 'ภายในระยะเวลาไม่เกิน 4 ชั่วโมงนับจากระยะเวลารับสิ่งส่งตรวจ', limitEn: 'Within 4 hours of specimen receipt',
    emoji: '🩸',
  },
  {
    sectionTh: 'จุลชีววิทยาคลินิก', sectionEn: 'Microbiology',
    limitTh: 'ภายในระยะเวลาไม่เกิน 2 ชั่วโมงนับจากระยะเวลารับสิ่งส่งตรวจ', limitEn: 'Within 2 hours of specimen receipt',
    emoji: '🧫',
  },
  {
    sectionTh: 'คลังเลือด', sectionEn: 'Blood Bank',
    limitTh: 'ภายในระยะเวลาไม่เกิน 24 ชั่วโมงนับจากระยะเวลารับสิ่งส่งตรวจ', limitEn: 'Within 24 hours of specimen receipt',
    emoji: '🩸',
  },
  {
    sectionTh: 'อณูชีววิทยา', sectionEn: 'Biomolecular',
    limitTh: 'เก็บสิ่งตัวอย่างส่งตรวจใหม่', limitEn: 'Recollect a new specimen',
    emoji: '🧬',
  },
  {
    sectionTh: 'ตรวจพิเศษ', sectionEn: 'Specialist',
    limitTh: 'เก็บสิ่งตัวอย่างส่งตรวจใหม่', limitEn: 'Recollect a new specimen',
    emoji: '🔗',
  },
]

interface RetentionItem {
  sectionTh: string; sectionEn: string
  durationTh: string[]; tempTh: string
  scale: 'hours' | 'days' | 'weeks' | 'special'
  heroTh: string; heroEn: string
  emoji: string
}
const RETENTION: RetentionItem[] = [
  {
    sectionTh: 'จุลทรรศนศาสตร์คลินิก', sectionEn: 'Clinical Microscopy',
    durationTh: [
      '24 ชม. อุณหภูมิห้อง',
      'Urine ที่ส่งตรวจหาสารเสพติดและให้ผล Positive จะเก็บตัวอย่างนาน 2 เดือนในตู้เย็น 2-8 °C',
    ], tempTh: 'อุณหภูมิห้อง',
    scale: 'hours', heroTh: '24 ชม.', heroEn: '24 h',
    emoji: '🔬',
  },
  {
    sectionTh: 'เคมีคลินิก', sectionEn: 'Clinical Chemistry',
    durationTh: ['24 ชม. 2–8°C'], tempTh: '2–8°C',
    scale: 'hours', heroTh: '24 ชม.', heroEn: '24 h',
    emoji: '⚗️',
  },
  {
    sectionTh: 'โลหิตวิทยาคลินิก', sectionEn: 'Hematology',
    durationTh: [
      '3 วัน 2–8°C',
      'สไลด์ Blood Smear 7 วัน อุณหภูมิห้อง',
    ], tempTh: '2–8°C',
    scale: 'days', heroTh: '3 วัน', heroEn: '3 d',
    emoji: '🩸',
  },
  {
    sectionTh: 'ภูมิคุ้มกันวิทยาคลินิก', sectionEn: 'Immunology',
    durationTh: [
      '7 วันทำการ 2–8°C',
      '<strong>Anti-HIV Positive</strong>: 15 วันทำการ',
      'ตัวอย่างส่งตรวจ <strong>Acid phosphatase for semen</strong> (ที่เหลือจากการตรวจวิเคราะห์) เก็บนาน 5 ปีที่อุณหภูมิห้อง',
      'สไลด์จากการย้อม <strong>Spermatozoa (คดี)</strong> เก็บนาน 10 ปี ที่อุณหภูมิห้อง',
    ], tempTh: '2–8°C',
    scale: 'weeks', heroTh: '7 วัน', heroEn: '7 d',
    emoji: '🛡️',
  },
  {
    sectionTh: 'จุลชีววิทยาคลินิก', sectionEn: 'Microbiology',
    durationTh: ['4 วัน 2–8°C'], tempTh: '2–8°C',
    scale: 'days', heroTh: '4 วัน', heroEn: '4 d',
    emoji: '🧫',
  },
  {
    sectionTh: 'คลังเลือด', sectionEn: 'Blood Bank',
    durationTh: ['7 วัน 2–6°C'], tempTh: '2–6°C',
    scale: 'weeks', heroTh: '7 วัน', heroEn: '7 d',
    emoji: '🩸',
  },
  {
    sectionTh: 'อณูชีววิทยา', sectionEn: 'Biomolecular',
    durationTh: [
      'CD4 / Pharmacogenetics 7 วัน',
      'Viral load 1 เดือน 2–8°C',
      'Viral load ที่ต้องส่ง Drug resistance: 3 เดือน ในตู้เย็น -20 °C',
      'DNA/RNA 2 ปี -20°C',
    ], tempTh: 'ขึ้นกับประเภท',
    scale: 'special', heroTh: 'หลากหลาย', heroEn: 'Varies',
    emoji: '🧬',
  },
  {
    sectionTh: 'ตรวจพิเศษ / OUT LAB', sectionEn: 'Specialist / OUT LAB',
    durationTh: ['Quadruple test 14 วัน 2–8°C'], tempTh: '2–8°C',
    scale: 'weeks', heroTh: '14 วัน', heroEn: '14 d',
    emoji: '🔗',
  },
]

const SCALE_STYLE: Record<RetentionItem['scale'], { color: string; bg: string; border: string }> = {
  hours:   { color: '#92400E', bg: 'rgba(217,119,6,.08)',   border: 'rgba(217,119,6,.22)'   },
  days:    { color: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.2)' },
  weeks:   { color: '#065F46', bg: 'rgba(22,163,74,.08)',   border: 'rgba(22,163,74,.22)'   },
  special: { color: '#5B21B6', bg: 'rgba(109,40,217,.07)',  border: 'rgba(109,40,217,.2)'   },
}

// ── Component ────────────────────────────────────────────────────────────────

export function ManualAddon({ lang }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const addon = useManualTable<EditableRow>('addonLimits', 'addon', ADDON_LIMITS as unknown as EditableRow[])
  const retention = useManualTable<EditableRow>('retention', 'addon', RETENTION as unknown as EditableRow[])
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          1. HEADER + INTRO
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H2 eyebrow="04 · Add-on & Repeat">
          {lang === 'th' ? 'การขอเพิ่มรายการทดสอบโดยใช้สิ่งตัวอย่างเดิม' : 'Add-on / Repeat from Existing Specimen'}
        </H2>
        <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.8, margin: 0 }}>
          {lang === 'th'
            ? 'การขอตรวจเพิ่มหรือตรวจซ้ำต้องประเมินคุณภาพและอายุของสิ่งตัวอย่างเดิม โดยใช้ตารางระยะเวลาเก็บรักษาสิ่งตัวอย่างหลังการตรวจวิเคราะห์เป็นเกณฑ์ การติดต่อทุกครั้งต้องบันทึกลงในแบบฟอร์ม Fm-WI-G-OV02/01'
            : 'Add-on or repeat tests require viability assessment per the post-analysis storage table. Every request must be logged on form Fm-WI-G-OV02/01 by the receiving MT.'}
        </p>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          2. WORKFLOW — role-annotated connected timeline
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {lang === 'th' ? 'ขั้นตอนการขอตรวจเพิ่ม / ตรวจซ้ำ' : 'Add-on & Repeat Workflow'}
          </h3>
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            5 {lang === 'th' ? 'ขั้นตอน' : 'steps'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {STEPS.map((step, i) => {
            const isLast = i === STEPS.length - 1
            return (
              <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>

                {/* Spine */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 13, color: step.roleColor,
                    background: step.roleBg,
                    border: `2px solid ${step.roleColor}40`,
                  }}>
                    {i + 1}
                  </div>
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, minHeight: 12, background: 'var(--border)', margin: '3px 0' }} />
                  )}
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, minWidth: 0, marginLeft: 10,
                  marginBottom: isLast ? 0 : 10,
                  padding: '11px 14px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${step.roleColor}`,
                  borderRadius: 9,
                }}>
                  <div style={{ marginBottom: 5 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '2px 9px', borderRadius: 20,
                      background: step.roleBg,
                      fontSize: 11, fontWeight: 700, color: step.roleColor,
                      letterSpacing: '.01em',
                    }}>
                      {lang === 'th' ? step.roleTh : step.roleEn}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
                    {lang === 'th' ? step.th : step.en}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          3. ADD-ON TIME LIMIT — clean reference table
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          {lang === 'th' ? 'ระยะเวลาของการเพิ่มรายการทดสอบโดยใช้ตัวอย่างเดิม' : 'Add-on Test Time Limit (Existing Specimen)'}
        </h3>

        {addon.canEdit && editing !== 'addonLimits' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setEditing('addonLimits')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              แก้ตาราง
            </button>
          </div>
        )}
        {editing === 'addonLimits' ? (
          <ManualTableEditor schema={TABLE_SCHEMAS.addonLimits} rows={addon.rows}
            onSaved={rows => { addon.setRows(rows); setEditing(null) }}
            onCancel={() => setEditing(null)} />
        ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', width: '52%', borderRight: '1px solid var(--border)' }}>
                  {lang === 'th' ? 'งาน' : 'Section'}
                </th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'ระยะเวลาเพิ่มรายการตรวจวิเคราะห์โดยใช้ตัวอย่างเดิม' : 'Add-on Time Limit'}
                </th>
              </tr>
            </thead>
            <tbody>
              {addon.rows.map((row, i) => {
                const a = row as unknown as AddonLimitItem
                return (
                <tr key={i}
                  style={{ borderBottom: i < addon.rows.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background .1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.5 }}>{a.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                          {lang === 'th' ? `งาน${a.sectionTh}` : a.sectionEn}
                        </div>
                        {(a.examplesTh || a.examplesEn) && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 2 }}>
                            ({lang === 'th' ? a.examplesTh : a.examplesEn})
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
                    {lang === 'th' ? a.limitTh : a.limitEn}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Note */}
        <div style={{
          display: 'flex', gap: 10, marginTop: 12,
          padding: '11px 14px',
          background: 'var(--primary-soft)',
          border: '1px solid rgba(30,95,173,.2)',
          borderRadius: 9,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>📋</span>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
            {lang === 'th'
              ? <span><strong>หมายเหตุ:</strong> เกณฑ์การพิจารณาการตรวจวิเคราะห์โดยใช้ตัวอย่างเดิม พิจารณาจากข้อแนะนำในการเก็บสิ่งตัวอย่างส่งตรวจ (specimen collection) ของวิธีการตรวจวิเคราะห์แต่ละรายการ</span>
              : <span><strong>Note:</strong> Eligibility to reuse an existing specimen is judged against the specimen collection guidance for each individual test method.</span>}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          4. RETENTION — clean reference table
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          {lang === 'th' ? 'ระยะเวลาเก็บสิ่งตัวอย่างหลังการตรวจวิเคราะห์' : 'Post-analysis Specimen Retention'}
        </h3>
        <style>{`.retention-dur strong { color: var(--ink); font-weight: 700; }`}</style>

        {retention.canEdit && editing !== 'retention' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setEditing('retention')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              แก้ตาราง
            </button>
          </div>
        )}
        {editing === 'retention' ? (
          <ManualTableEditor schema={TABLE_SCHEMAS.retention} rows={retention.rows}
            onSaved={rows => { retention.setRows(rows); setEditing(null) }}
            onCancel={() => setEditing(null)} />
        ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', width: '38%', borderRight: '1px solid var(--border)' }}>
                  {lang === 'th' ? 'งาน' : 'Section'}
                </th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                  {lang === 'th' ? 'ระยะเวลาเก็บ' : 'Retention'}
                </th>
              </tr>
            </thead>
            <tbody>
              {retention.rows.map((row, i) => {
                const r = row as unknown as RetentionItem
                return (
                <tr key={i}
                  style={{ borderBottom: i < retention.rows.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background .1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                          {lang === 'th' ? `งาน${r.sectionTh}` : r.sectionEn}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }} className="retention-dur">
                    {r.durationTh.map((line, li) => (
                      <div key={li}>: <span dangerouslySetInnerHTML={{ __html: line }} /></div>
                    ))}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Expired specimen notice */}
        <div style={{
          display: 'flex', gap: 10, marginTop: 12,
          padding: '11px 14px',
          background: 'var(--primary-soft)',
          border: '1px solid rgba(30,95,173,.2)',
          borderRadius: 9,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>🕐</span>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
            {lang === 'th'
              ? <span>หากสิ่งตัวอย่างหมดเวลาเก็บแล้ว ต้องเก็บตัวอย่างใหม่ — ติดต่อ <strong style={{ color: 'var(--primary)' }}>โทร. 1455</strong> เพื่อจัดเตรียมภาชนะที่เหมาะสม</span>
              : <span>If the specimen has exceeded its retention window, recollection is required — call <strong style={{ color: 'var(--primary)' }}>ext. 1455</strong> to coordinate the appropriate container.</span>}
          </div>
        </div>
      </Section>
    </>
  )
}
