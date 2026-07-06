import { H2, H3, Section, Callout, Th, TblRow } from '../_primitives'
import type { Lang } from '../data'

interface Props { lang: Lang }

// ── Data ─────────────────────────────────────────────────────────────────────

type RejectionCategory = 'เอกสาร' | 'สิ่งตัวอย่าง' | 'ลายเซ็น'
interface RejectionCriterion { id: number; text: string; category: RejectionCategory }

const REJECTION_CRITERIA: RejectionCriterion[] = [
  { id: 1,  text: 'ชื่อ-สกุล ในใบนำส่งตรวจและสิ่งตัวอย่างส่งตรวจไม่ตรงกัน',                    category: 'เอกสาร'       },
  { id: 2,  text: 'ใบนำส่งตรวจและสิ่งตัวอย่างส่งตรวจไม่มีรายชื่อผู้ป่วย',                         category: 'เอกสาร'       },
  { id: 3,  text: 'สิ่งตัวอย่างส่งตรวจที่ Hemolysis',                                              category: 'สิ่งตัวอย่าง' },
  { id: 4,  text: 'ใบนำส่งตรวจไม่ได้ระบุ test หรือส่วนประกอบของเลือดที่ต้องการ',                  category: 'เอกสาร'       },
  { id: 5,  text: 'ใบขอเลือดไม่ได้ลงนามพยาบาลผู้เจาะเลือด หรือผู้รับคำสั่งการขอเลือด',            category: 'ลายเซ็น'      },
  { id: 6,  text: 'ใบขอเลือดกรณีเร่งด่วนไม่ได้ลงนามแพทย์ผู้ขอเลือด',                             category: 'ลายเซ็น'      },
  { id: 7,  text: 'สิ่งตัวอย่างส่งตรวจมีปริมาณน้อยมาก ไม่เพียงพอต่อการเตรียมเลือดให้ผู้ป่วย',     category: 'สิ่งตัวอย่าง' },
  { id: 8,  text: 'สิ่งตัวอย่างส่งตรวจหกเลอะ ภาชนะที่เก็บมาแตก หลอดเลือดเปื้อนสกปรก',           category: 'สิ่งตัวอย่าง' },
  { id: 9,  text: 'ใบนำส่งตรวจ หรือใบขอเลือดเปื้อนเลือด สกปรก',                                 category: 'เอกสาร'       },
  { id: 10, text: 'เจาะเลือดใส่หลอดเลือดผิดประเภท',                                                category: 'สิ่งตัวอย่าง' },
]

const CAT: Record<RejectionCategory, { color: string; bg: string; border: string; accent: string }> = {
  'เอกสาร':       { color: 'var(--primary)', bg: 'rgba(30,95,173,.08)',  border: 'rgba(30,95,173,.18)',  accent: 'var(--primary)' },
  'สิ่งตัวอย่าง': { color: '#92400E',        bg: 'rgba(217,119,6,.08)',  border: 'rgba(217,119,6,.22)',  accent: '#D97706'        },
  'ลายเซ็น':      { color: '#5B21B6',        bg: 'rgba(109,40,217,.07)', border: 'rgba(109,40,217,.18)', accent: '#7C3AED'        },
}

interface UrgentMethod { no: number; levelTh: string; descTh: string; time: string; timeBg: string; timeColor: string; headerBg: string; detailTh: string }
const URGENT_METHODS: UrgentMethod[] = [
  {
    no: 1, levelTh: 'ด่วนมาก', descTh: 'จ่ายเลือด O, LPRC/PRC',
    time: '5', timeBg: 'var(--danger)', timeColor: '#fff', headerBg: 'rgba(220,38,38,.06)',
    detailTh: 'ใช้เมื่อ ไม่สามารถเจาะเลือดตรวจหมู่ได้ อยู่ในดุลยพินิจแพทย์ผู้ดูแล — จ่าย LPRC ก่อน ถ้า LPRC น้อยจะจ่าย PRC พร้อมเอกสาร Motorway Trauma Fast Track (Fm-WI-T-BB06/03)',
  },
  {
    no: 2, levelTh: 'ด่วน', descTh: 'จ่ายตามหมู่ ABO ของผู้ป่วย',
    time: '10', timeBg: '#D97706', timeColor: '#fff', headerBg: 'rgba(217,119,6,.06)',
    detailTh: 'ใช้เมื่อ เจาะเลือดตรวจหมู่ได้ แต่รอไม่ได้เกิน 10 นาที — หลังจ่ายแล้วคลังเลือดจะดำเนิน ABO, Rh, Crossmatch และ Antibody screening ต่อ เอกสารสมบูรณ์ส่งตาม ~30 นาที',
  },
  {
    no: 3, levelTh: 'ปกติเร่งด่วน', descTh: 'ABO + Rh + Crossmatch + Antibody screening',
    time: '30', timeBg: 'var(--success)', timeColor: '#fff', headerBg: 'rgba(22,163,74,.06)',
    detailTh: 'ตรวจครบทุกขั้นตอนก่อนจ่ายเลือด: ABO · Rh · Crossmatch · Antibody screening test อย่างสมบูรณ์',
  },
]

interface WorkflowPhase {
  no: number
  titleTh: string
  roleTh: string
  roleColor: string
  roleBg: string
  steps: string[]
}
const WORKFLOW_PHASES: WorkflowPhase[] = [
  {
    no: 1, titleTh: 'ขั้นตอนการขอเลือด', roleTh: 'พยาบาลที่ได้รับมอบหมาย',
    roleColor: 'var(--primary)', roleBg: 'var(--primary-soft)',
    steps: [
      'อ่านคำสั่งการรักษา ตรวจสอบ ชื่อ-สกุล · วัน/เดือน ปีเกิด · H.N. ให้ถูกต้อง',
      'บันทึกการขอเลือดในระบบให้ครบถ้วน พิมพ์ใบขอเลือดและ Sticker ติดหลอดเลือดก่อนเจาะทุกครั้ง — ผู้เตรียมหลอดและผู้เจาะควรเป็นคนเดียวกัน',
      'เจาะเลือดที่เตียง สอบถามชื่อ-สกุล วัน/เดือน ปีเกิดโดยให้ผู้ป่วยเป็นผู้บอก และสอบถามประวัติการรับเลือดก่อนหน้า',
      'ก่อนดันเลือดใส่หลอด ตรวจสอบชื่อ-สกุลอีกครั้ง — กรณีขอหลายราย ต้องเจาะให้เสร็จทีละรายเท่านั้น',
      'ส่งมอบใบขอเลือด + หลอดเลือดให้เจ้าหน้าที่นำส่งคลังเลือด โดยตรวจสอบร่วมกันก่อน',
    ],
  },
  {
    no: 2, titleTh: 'รับใบขอเลือดและเตรียมเลือด', roleTh: 'เจ้าหน้าที่งานคลังเลือด',
    roleColor: '#92400E', roleBg: 'rgba(217,119,6,.1)',
    steps: [
      'รับใบขอเลือดและหลอดเลือด ตรวจสอบความถูกต้องครบถ้วน ต้องตรงกับชื่อผู้ป่วยบนหลอดทุกครั้ง',
      'บันทึกเวลารับ และตรวจสอบประวัติหมู่เลือด ABO / Rh เดิมในระบบ',
      'ตรวจหมู่เลือด ABO และ Rh ทุกราย ทั้งรายใหม่และรายเก่า — ถ้าหมู่เลือดขัดแย้งกับประวัติเดิม แจ้งหอผู้ป่วยทันที',
      'เตรียมเลือดตามขั้นตอน Compatibility test (X-Matching test)',
      'เตรียมเลือดทีละรายโดยเด็ดขาด ห้ามเตรียมพร้อมกัน ตรวจสอบและลงชื่อทุกครั้ง',
    ],
  },
  {
    no: 3, titleTh: 'รับเลือดและจ่ายเลือดจากคลังเลือด', roleTh: 'เจ้าหน้าที่ + หอผู้ป่วย',
    roleColor: '#5B21B6', roleBg: 'rgba(109,40,217,.09)',
    steps: [
      'หอผู้ป่วยโทรแจ้งคลังเลือด (โทร. 1458) ขอให้จัดส่งเลือด',
      'คลังเลือดหยิบใบขอเลือด + เลือด ตรวจสอบ บันทึก แล้วใส่กระติกขนส่งอุณหภูมิ 1–10°C',
      'หอผู้ป่วยตรวจสอบเมื่อรับเลือด หากไม่ถูกต้องให้คืนทันที',
      'แจ้งส่งเลือดเมื่อพร้อมให้เท่านั้น — นำเลือดไปแล้วแต่ไม่พร้อมให้ภายใน 30 นาที ควรส่งคืนคลังเลือด',
    ],
  },
  {
    no: 4, titleTh: 'ขั้นตอนการให้เลือด', roleTh: 'พยาบาลผู้รับผิดชอบ',
    roleColor: '#065F46', roleBg: 'rgba(5,150,105,.1)',
    steps: [
      'ตรวจสอบ ชื่อ-สกุล · วัน/เดือน ปีเกิด · H.N. · A.N. · ชนิดเลือด · หมู่เลือด · เลขถุง ให้ตรงกับใบคล้องถุงและคำสั่งรักษา',
      'สอบถามชื่อ-สกุล วัน/เดือน ปีเกิดก่อนให้เลือดทุกครั้ง และแจ้งหมู่เลือดให้ผู้ป่วยทราบ',
      'ปฏิบัติตามมาตรฐานการให้เลือดของกลุ่มการพยาบาล — ผู้เตรียมและผู้ให้ควรเป็นคนเดียวกัน',
    ],
  },
]

interface Precaution { icon: string; title: string; body: string; urgency: 'high' | 'medium' | 'low' }
const PRECAUTIONS: Precaution[] = [
  { urgency: 'low',    icon: '👁',  title: 'สังเกตอาการ', body: 'สังเกตอาการตามมาตรฐานการให้เลือดตลอดกระบวนการ' },
  { urgency: 'high',   icon: '⚡',  title: '1–5 นาทีแรก', body: 'สังเกตปฏิกิริยา: ผื่นขึ้น · หนาวสั่น · แน่นหน้าอก · หายใจลำบาก — ถ้าพบให้หยุดทันทีและรายงานแพทย์' },
  { urgency: 'high',   icon: '🔴',  title: 'ปัสสาวะสีแดง', body: 'ขณะให้เลือดตรวจสอบสีปัสสาวะ — ถ้าผิดปกติ (สีแดง) ให้รายงานแพทย์ทันที' },
  { urgency: 'medium', icon: '🏷',  title: 'ผู้ป่วยไม่รู้สึกตัว / เด็ก', body: 'ตรวจสอบชื่อ-สกุล วัน/เดือน ปีเกิด จากป้ายข้อมือ · ป้ายหน้าเตียง และ/หรือญาติผู้ป่วย' },
]

const RETENTION_DATA = [
  { type: 'ผู้ใหญ่', days: 3, color: 'var(--primary)', bg: 'var(--primary-soft)' },
  { type: 'เด็ก', days: 5, color: '#7C3AED', bg: 'rgba(124,58,237,.09)' },
  { type: 'ห้องคลอด', days: 2, color: '#D97706', bg: 'rgba(217,119,6,.09)' },
  { type: 'เกร็ดเลือด', days: 1, color: 'var(--danger)', bg: 'rgba(220,38,38,.08)' },
]

const ABO_STEPS = [
  { label: 'ไม่มีประวัติหมู่เลือด', detail: 'เจาะเลือดใส่ Hematocrit tube หรือ EDTA tube 1 หลอด พร้อมใบส่งตรวจ ABO ซ้ำ — ต้องเจาะคนละเวลากับครั้งแรก' },
  { label: 'ยืนยันและประทับตรา', detail: 'คลังเลือดตรวจ ABO แล้วประทับตรา "ผ่านการตรวจยืนยันหมู่เลือด ABO แล้ว" ในใบขอเลือด' },
  { label: 'กรณีเตรียมผ่าตัด', detail: 'ต้องยืนยัน ABO ให้เรียบร้อยก่อนแจ้งจัดส่งเลือดทุกกรณี' },
  { label: 'มีประวัติ ABO ในระบบ', detail: 'พิมพ์ผลการตรวจหมู่เลือด ABO ติดมากับใบขอเลือดเพื่อยืนยันได้เลย' },
  { label: 'ผล ABO ซ้ำขัดแย้ง', detail: 'ต้องตรวจสอบและแก้ไขให้ถูกต้องก่อนจ่ายเลือดทุกกรณี' },
  { label: 'รายด่วนรายใหม่', detail: 'คลังเลือดจะแยกหลอดเลือดออก — ถ้าขอเลือดซ้ำต้องเจาะเลือดผู้ป่วยใหม่' },
]

const CANNOT_RETURN = [
  'นำเลือดออกจากกระติกขนส่งเลือดมากกว่า 30 นาที',
  'เลือดที่ผ่านการอุ่นแล้ว',
  'เลือดที่ผ่านการเสียบอุปกรณ์การให้เลือดแล้ว',
]

interface AlertRow { value: string; actions: string[] }
const ALERT_ROWS: AlertRow[] = [
  {
    value: 'หมู่เลือดพิเศษ (Rh negative)',
    actions: ['แจ้งหอผู้ป่วยเพื่อรายงานแพทย์ผู้รักษา', 'ตรวจคัดกรองหา Antibody ในตัวอย่างเลือดผู้ป่วย'],
  },
  {
    value: 'ตรวจพบ Antibody ของหมู่เลือดระบบอื่นๆ',
    actions: ['แจ้งหอผู้ป่วยเพื่อรายงานแพทย์ผู้รักษา', 'ตรวจแยกชนิด Antibody', 'จัดหาเลือดที่ปลอดภัยให้ผู้ป่วย (ไม่มี Antigen ชนิดเดียวกับ Antibody ที่พบ)'],
  },
]

// ── Style helpers ─────────────────────────────────────────────────────────────

const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }

// ── Component ────────────────────────────────────────────────────────────────

export function ManualBloodBank({ lang }: Props) {
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          1. PAGE HEADER + REJECTION CRITERIA
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H2 eyebrow="Blood Bank · โทร. 1458">
          {lang === 'th' ? 'การใช้บริการคลังเลือด' : 'Blood Bank Service'}
        </H2>

        {/* Section title with count badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <H3>
            {lang === 'th' ? 'เกณฑ์การปฏิเสธสิ่งตัวอย่างส่งตรวจ' : 'Specimen Rejection Criteria'}
          </H3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(CAT) as RejectionCategory[]).map(cat => {
              const s = CAT[cat]
              const n = REJECTION_CRITERIA.filter(c => c.category === cat).length
              return (
                <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, fontSize: 11.5, fontWeight: 700, color: s.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.accent }} />
                  {cat} ({n})
                </span>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 7 }}>
          {REJECTION_CRITERIA.map(c => {
            const s = CAT[c.category]
            return (
              <div key={c.id} style={{ display: 'flex', gap: 11, padding: '11px 13px', background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${s.accent}`, borderRadius: 9 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: s.color, background: s.bg, border: `1.5px solid ${s.border}`, marginTop: 1 }}>
                  {c.id}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: s.color, fontWeight: 700, marginBottom: 3, letterSpacing: '.02em', textTransform: 'uppercase' }}>{c.category}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{c.text}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          2. URGENT BLOOD REQUESTS — horizontal urgency spectrum
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <H3>
            {lang === 'th' ? 'ข้อตกลงการขอเลือดในกรณีเร่งด่วน' : 'Emergency Blood Request Protocol'}
          </H3>
          <div style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', fontSize: 11.5, fontWeight: 700, color: 'var(--danger)', whiteSpace: 'nowrap' }}>
            PRC ≤ 4 ยูนิต · ตลอด 24 ชม.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
          {URGENT_METHODS.map(m => (
            <div key={m.no} style={{ border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Header strip */}
              <div style={{ background: m.headerBg, borderBottom: '1px solid var(--border)', padding: '12px 14px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>วิธีที่ {m.no}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{m.levelTh}</span>
                </div>
                {/* Time hero */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 10, background: m.timeBg, flexShrink: 0 }}>
                    <span style={{ fontSize: 19, fontWeight: 900, color: m.timeColor, letterSpacing: '-.03em' }}>{m.time}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.3, paddingBottom: 4 }}>นาที<br/>ภายใน</span>
                </div>
              </div>
              {/* Description */}
              <div style={{ padding: '10px 14px 6px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{m.descTh}</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>{m.detailTh}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          3. NORMAL BLOOD REQUEST — stat duo
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'การขอเลือดแบบปกติ (ไม่เร่งด่วน)' : 'Routine Blood Request'}</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
          {[
            { label: 'เวลาเตรียมเลือด', value: '2', unit: 'ชม.', desc: 'นับจากเวลาที่ได้รับใบขอเลือด', accent: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.2)' },
            { label: 'ระยะเวลาจองเลือด', value: '48', unit: 'ชม.', desc: 'หากไม่มีการจ่าย คลังเลือดจะปลดเลือดออกเพื่อสำรองให้ผู้ป่วยรายอื่น', accent: '#D97706', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.22)' },
          ].map(item => (
            <div key={item.label} style={{ padding: '16px 18px', border: `1px solid ${item.border}`, borderLeft: `4px solid ${item.accent}`, borderRadius: 10, background: item.bg }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.accent, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8, opacity: .85 }}>{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: item.accent, letterSpacing: '-.04em', lineHeight: 1 }}>{item.value}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: item.accent, opacity: .8 }}>{item.unit}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          4. PREVENTION WORKFLOW — vertical phase timeline
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'วิธีปฏิบัติการป้องกันการให้เลือดผิดคน / ผิดหมู่' : 'Prevention of Wrong Blood Transfusion'}</H3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {WORKFLOW_PHASES.map((phase, pi) => (
            <div key={phase.no} style={{ display: 'flex', gap: 0 }}>
              {/* Left spine */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0, paddingTop: 2 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: phase.roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#fff', flexShrink: 0, zIndex: 1, border: '2px solid var(--card)' }}>
                  {phase.no}
                </div>
                {pi < WORKFLOW_PHASES.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: 'var(--border)', margin: '4px 0', minHeight: 20 }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingBottom: pi < WORKFLOW_PHASES.length - 1 ? 18 : 0, paddingLeft: 12 }}>
                {/* Phase header */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{phase.titleTh}</span>
                  <span style={{ padding: '2px 9px', borderRadius: 20, background: phase.roleBg, fontSize: 11.5, fontWeight: 700, color: phase.roleColor }}>
                    {phase.roleTh}
                  </span>
                </div>

                {/* Step list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {phase.steps.map((step, si) => (
                    <div key={si} style={{ display: 'flex', gap: 10, padding: '9px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: phase.roleBg, border: `1px solid ${phase.roleColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: phase.roleColor }}>{si + 1}</span>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Callout tone="warning" icon="alert">
          <strong>กรณีผู้ป่วยหรือญาติมีข้อสงสัยว่าหมู่เลือดไม่ตรงกัน</strong> — ต้องหยุดการเตรียมการให้เลือดทันที และแจ้งงานคลังเลือดเพื่อเจาะเลือดตรวจยืนยันหมู่เลือดซ้ำก่อนดำเนินการต่อ
        </Callout>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          5. TRANSFUSION PRECAUTIONS — attention cards
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'ข้อควรระวังในการให้เลือด' : 'Transfusion Precautions'}</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 8 }}>
          {PRECAUTIONS.map((p, i) => {
            const urgencyMap = {
              high:   { border: 'rgba(220,38,38,.25)', bg: 'rgba(220,38,38,.05)', stripe: 'var(--danger)',   label: 'ด่วน', labelColor: 'var(--danger)', labelBg: 'rgba(220,38,38,.1)' },
              medium: { border: 'rgba(217,119,6,.25)',  bg: 'rgba(217,119,6,.05)',  stripe: 'var(--warning)', label: 'สังเกต', labelColor: '#92400E', labelBg: 'rgba(217,119,6,.1)' },
              low:    { border: 'var(--border)',         bg: 'var(--card)',          stripe: 'var(--border)',  label: 'ทั่วไป', labelColor: 'var(--muted)', labelBg: 'var(--surface-2)' },
            }
            const u = urgencyMap[p.urgency]
            return (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '13px 14px', background: u.bg, border: `1px solid ${u.border}`, borderLeft: `3px solid ${u.stripe}`, borderRadius: 9 }}>
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.2, marginTop: 1 }}>{p.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{p.title}</span>
                    <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10.5, fontWeight: 700, color: u.labelColor, background: u.labelBg }}>{u.label}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>{p.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          6. BLOOD DISTRIBUTION — FEFO + retention grid + ABO verification
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <H3 mt={0}>{lang === 'th' ? 'การจ่ายเลือด และใช้เลือดอย่างเหมาะสม' : 'Blood Distribution'}</H3>
          <span style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(30,95,173,.08)', border: '1px solid rgba(30,95,173,.18)', fontSize: 11.5, fontWeight: 800, color: 'var(--primary)', letterSpacing: '.04em', flexShrink: 0 }}>FEFO</span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
          ห้ามนำเลือดไปเก็บที่ตึกผู้ป่วย — เมื่อไม่ใช้ให้แจ้งเจ้าหน้าที่ขนส่งรับคืนทันที หรือฝากแช่ที่คลังเลือด
        </p>

        {/* Retention duration grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
            ระยะเวลาปลดเลือดจองหลังเตรียมให้
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 92px), 1fr))', gap: 8 }}>
            {RETENTION_DATA.map(r => (
              <div key={r.type} style={{ padding: '12px 14px', background: r.bg, border: `1px solid ${r.color}33`, borderRadius: 9, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: r.color, letterSpacing: '-.03em', lineHeight: 1 }}>{r.days}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: r.color, marginTop: 2, opacity: .8 }}>วัน</div>
                <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, marginTop: 6 }}>{r.type}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ABO verification steps */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          ขั้นตอนการยืนยันหมู่เลือด ABO ก่อนจ่ายเลือด
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {ABO_STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: i < ABO_STEPS.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--card)' : 'var(--bg)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-soft)', border: '1.5px solid rgba(30,95,173,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: 'var(--primary)', marginTop: 1 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          7. BLOOD RETURN — cannot-return callout
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'การรับคืนเลือด' : 'Blood Return Policy'}</H3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 9, marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>📞</span>
          <div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
              หากยังไม่ได้ใช้เลือด แจ้งงานคลังเลือด
            </span>
            <strong style={{ fontSize: 14, color: 'var(--primary)', marginLeft: 6 }}>โทร. 1458</strong>
            <span style={{ fontSize: 13, color: 'var(--ink)', marginLeft: 4 }}>เพื่อให้เจ้าหน้าที่มารับเลือดคืน</span>
          </div>
        </div>

        <div style={{ background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 9, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
            เลือดที่ไม่สามารถรับคืนได้
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {CANNOT_RETURN.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✕</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          8. ALERT VALUES — diagnostic panels
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'Alert Value ทางงานคลังเลือด' : 'Blood Bank Alert Values'}</H3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ALERT_ROWS.map((r, i) => (
            <div key={i} style={{ border: '1px solid rgba(220,38,38,.22)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Alert header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(220,38,38,.06)', borderBottom: '1px solid rgba(220,38,38,.15)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>!</span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#B91C1C' }}>{r.value}</span>
              </div>
              {/* Action list */}
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7, background: 'var(--card)' }}>
                {r.actions.map((a, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(220,38,38,.08)', border: '1.5px solid rgba(220,38,38,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: 'var(--danger)', marginTop: 1 }}>
                      {j + 1}
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
