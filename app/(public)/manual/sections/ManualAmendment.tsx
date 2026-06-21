import { H2, H3, Section, Callout } from '../_primitives'
import { Icon } from '@/components/ui/Icon'
import type { Lang } from '../data'

interface Props { lang: Lang }

// ── Form reference ────────────────────────────────────────────────────────────
const FORM_CODE = 'Fm-QP-LAB-21/03'
const FORM_FILE = '/documents/Fm-QP-LAB-21-03.pdf'
const FORM_DL_NAME = 'Fm-QP-LAB-21-03 แบบคำขอแก้ไขยกเลิกเปลี่ยนแปลงข้อมูลผลตรวจ.pdf'

// ── Data ──────────────────────────────────────────────────────────────────────

// ส่วนที่ 1 — มีความประสงค์ (request purposes)
const REQUEST_TYPES = [
  { icon: 'edit',  th: 'แก้ไขข้อมูลผู้ป่วย / สิ่งส่งตรวจ',   en: 'Correct patient / specimen data' },
  { icon: 'doc',   th: 'แก้ไขรายการตรวจที่ยังไม่รายงานผล',   en: 'Amend orders not yet reported' },
  { icon: 'x',     th: 'ยกเลิกผลตรวจที่รายงานแล้ว',          en: 'Cancel an already-reported result' },
  { icon: 'users', th: 'ย้ายผลตรวจไปยังผู้ป่วยที่ถูกต้อง',   en: 'Move result to the correct patient' },
  { icon: 'inbox', th: 'ขอออกรายงานฉบับแก้ไข / ฉบับทดแทน',   en: 'Issue an amended / replacement report' },
  { icon: 'plus',  th: 'อื่น ๆ',                            en: 'Other' },
]

// แผนผังขั้นตอน (workflow)
interface WorkflowStep {
  icon: string; accent: string; bg: string
  th: { title: string; body: React.ReactNode }
  en: { title: string; body: React.ReactNode }
  form?: boolean
}
const WORKFLOW: WorkflowStep[] = [
  {
    icon: 'phone', accent: 'var(--primary)', bg: 'var(--primary-soft)',
    th: { title: 'หน่วยงานแจ้งความประสงค์', body: <>หน่วยงานที่ต้องการแก้ไข ยกเลิก หรือเปลี่ยนแปลงข้อมูล/ผลการตรวจ <strong>โทรแจ้งห้องปฏิบัติการ</strong></> },
    en: { title: 'Unit notifies the lab', body: <>The requesting unit <strong>phones the laboratory</strong> to amend, cancel, or change data / results.</> },
  },
  {
    icon: 'edit', accent: '#0891B2', bg: 'rgba(8,145,178,.08)', form: true,
    th: { title: 'บันทึกแบบคำขอ', body: <>บันทึกรายละเอียดในแบบคำขอแก้ไข ยกเลิก หรือเปลี่ยนแปลงข้อมูล/ผลการตรวจทางห้องปฏิบัติการ (<strong>{FORM_CODE}</strong>)</> },
    en: { title: 'Complete the request form', body: <>Record the details on the amendment / cancellation request form (<strong>{FORM_CODE}</strong>).</> },
  },
  {
    icon: 'upload', accent: '#7C3AED', bg: 'rgba(124,58,237,.08)',
    th: { title: 'ส่งคำขอพร้อมหลักฐาน', body: 'ส่งแบบคำขอฯ พร้อมหลักฐาน/เอกสารแนบ มายังห้องปฏิบัติการ เพื่อให้ได้รับการแก้ไขทันที' },
    en: { title: 'Submit with evidence', body: 'Send the form together with supporting documents to the laboratory for prompt action.' },
  },
  {
    icon: 'check', accent: '#16A34A', bg: 'rgba(22,163,74,.08)',
    th: { title: 'ห้องปฏิบัติการดำเนินการ', body: 'ห้องปฏิบัติการพิจารณาคำขอ และทำการแก้ไขตามคำขอ' },
    en: { title: 'Laboratory processes the request', body: 'The laboratory reviews the request and performs the correction accordingly.' },
  },
]

// ส่วนของฟอร์ม (3 parts)
const FORM_PARTS = [
  {
    no: 1, color: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.2)',
    th: { title: 'ข้อมูลผู้ร้องขอและหน่วยงาน', who: 'ผู้ร้องขอ', items: [
      'วันที่ · เวลา · หน่วยงาน/หอผู้ป่วย',
      'ชื่อผู้ร้องขอ · ตำแหน่ง · เบอร์โทรติดต่อกลับ',
      'เลือกความประสงค์ และระบุ ชื่อ-สกุล / HN / LN ที่ต้องการแก้ไข',
      'กรณีย้ายผลตรวจ — แนบใบผลตรวจเดิมที่พิมพ์จาก E-Phis และระบุผู้ป่วยที่ถูกต้อง',
    ] },
    en: { title: 'Requester & unit', who: 'Requester', items: [
      'Date · time · unit / ward',
      'Requester name · position · callback number',
      'Select the purpose and specify name / HN / LN to amend',
      'For result transfer — attach the original E-Phis report and the correct patient',
    ] },
  },
  {
    no: 2, color: '#B45309', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.22)',
    th: { title: 'แพทย์', who: 'แพทย์ผู้รับผิดชอบ', items: [
      'ระบุ นพ./พญ. และรหัสแพทย์',
      'ตรวจสอบข้อมูลข้างต้น และเห็นชอบให้ห้องปฏิบัติการดำเนินการตามคำขอ',
      'ลงชื่อแพทย์ผู้รับผิดชอบ พร้อมวันที่',
    ] },
    en: { title: 'Physician', who: 'Responsible physician', items: [
      'Physician name and code',
      'Verify the information and approve the lab to proceed',
      'Sign and date',
    ] },
  },
  {
    no: 3, color: '#15803D', bg: 'rgba(22,163,74,.08)', border: 'rgba(22,163,74,.22)',
    th: { title: 'ห้องปฏิบัติการ', who: 'เจ้าหน้าที่ห้องปฏิบัติการ', items: [
      'ผลการพิจารณา: อนุมัติ / ไม่อนุมัติ (พร้อมเหตุผลหรือเงื่อนไข)',
      'การดำเนินการ: แก้ไขในระบบ · ยกเลิกผล/ออกฉบับทดแทน · ส่งต่อหัวหน้างาน/ผู้มีอำนาจ · ไม่ดำเนินการ',
      'ลงชื่อผู้ดำเนินการ พร้อมวันที่',
    ] },
    en: { title: 'Laboratory', who: 'Laboratory staff', items: [
      'Decision: approve / reject (with reason or condition)',
      'Action: edit in system · cancel / reissue · escalate to supervisor · no action',
      'Sign and date',
    ] },
  },
]

// ── Download button (prominent) ────────────────────────────────────────────────

function DownloadForm({ lang }: { lang: Lang }) {
  return (
    <a
      href={FORM_FILE}
      download={FORM_DL_NAME}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none',
        padding: '16px 18px', borderRadius: 14,
        background: 'linear-gradient(135deg, #1E5FAD, #0E3F7E)',
        boxShadow: '0 6px 20px rgba(30,95,173,.28)',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(30,95,173,.36)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(30,95,173,.28)' }}
    >
      <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="doc" size={24} style={{ color: '#fff' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,.18)', fontSize: 10.5, fontWeight: 800, color: '#fff', letterSpacing: '.05em', marginBottom: 5 }}>
          {FORM_CODE}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', lineHeight: 1.35 }}>
          {lang === 'th' ? 'แบบคำขอแก้ไข ยกเลิก หรือเปลี่ยนแปลงข้อมูล/ผลการตรวจ' : 'Result Amendment / Cancellation Request Form'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
          {lang === 'th' ? 'ดาวน์โหลดแบบฟอร์ม (PDF) เพื่อกรอกและส่งกลับห้องปฏิบัติการ' : 'Download the form (PDF), complete it, and return it to the lab'}
        </div>
      </div>
      <div
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, background: '#fff', color: 'var(--primary)', fontSize: 13.5, fontWeight: 800, flexShrink: 0 }}
      >
        <Icon name="download" size={16} style={{ color: 'var(--primary)' }} />
        {lang === 'th' ? 'ดาวน์โหลด' : 'Download'}
      </div>
    </a>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ManualAmendment({ lang }: Props) {
  return (
    <>
      {/* ══════════════ 1. HEADER + INTRO + DOWNLOAD ══════════════ */}
      <Section>
        <H2 eyebrow="09 · Amendment & Correction">
          {lang === 'th' ? 'การแก้ไขและเปลี่ยนแปลงข้อมูลทางห้องปฏิบัติการ' : 'Result Amendment & Correction'}
        </H2>

        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 16px', maxWidth: 680 }}>
          {lang === 'th'
            ? 'แนวทางสำหรับหน่วยงานที่ต้องการ แก้ไข ยกเลิก หรือเปลี่ยนแปลงข้อมูล/ผลการตรวจทางห้องปฏิบัติการ โดยทุกคำขอต้องบันทึกในแบบฟอร์มและผ่านการพิจารณาของห้องปฏิบัติการก่อนดำเนินการ'
            : 'Procedure for units that need to amend, cancel, or change laboratory data / results. Every request must be recorded on the form and reviewed by the laboratory before any action is taken.'}
        </p>

        <DownloadForm lang={lang} />
      </Section>

      {/* ══════════════ 2. REQUEST PURPOSES ══════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'ประเภทคำขอ (ความประสงค์)' : 'Request Types'}</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {REQUEST_TYPES.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={r.icon} size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{lang === 'th' ? r.th : r.en}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════ 3. WORKFLOW ══════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'แผนผังขั้นตอนการขอแก้ไข' : 'Amendment Workflow'}</H3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {WORKFLOW.map((step, i) => {
            const isLast = i === WORKFLOW.length - 1
            const t = lang === 'th' ? step.th : step.en
            return (
              <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                {/* Left spine */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: step.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, border: '2px solid var(--card)', boxShadow: `0 0 0 1px ${step.accent}33` }}>
                    <Icon name={step.icon} size={16} style={{ color: '#fff' }} />
                  </div>
                  {!isLast && <div style={{ width: 2, flex: 1, minHeight: 14, background: 'var(--border)', margin: '4px 0' }} />}
                </div>

                {/* Content card */}
                <div style={{ flex: 1, minWidth: 0, marginLeft: 12, marginBottom: isLast ? 0 : 12, padding: '12px 16px', background: step.bg, border: `1px solid ${step.accent}2e`, borderLeft: `3px solid ${step.accent}`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: step.accent, letterSpacing: '.05em' }}>{lang === 'th' ? `ขั้นที่ ${i + 1}` : `STEP ${i + 1}`}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{t.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{t.body}</div>

                  {step.form && (
                    <a
                      href={FORM_FILE}
                      download={FORM_DL_NAME}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '6px 12px', borderRadius: 7, background: step.accent, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.88' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                    >
                      <Icon name="download" size={13} style={{ color: '#fff' }} />
                      {lang === 'th' ? `ดาวน์โหลด ${FORM_CODE}` : `Download ${FORM_CODE}`}
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ══════════════ 4. FORM PARTS ══════════════ */}
      <Section>
        <H3 mt={0}>{lang === 'th' ? 'องค์ประกอบของแบบคำขอ' : 'Structure of the Request Form'}</H3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FORM_PARTS.map((p) => {
            const t = lang === 'th' ? p.th : p.en
            return (
              <div key={p.no} style={{ border: `1px solid ${p.border}`, borderRadius: 11, overflow: 'hidden' }}>
                {/* Header strip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', background: p.bg, borderBottom: `1px solid ${p.border}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: p.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{p.no}</div>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>
                    {lang === 'th' ? `ส่วนที่ ${p.no} · ${t.title}` : `Part ${p.no} · ${t.title}`}
                  </span>
                  <span style={{ marginLeft: 'auto', padding: '2px 9px', borderRadius: 20, background: 'var(--card)', border: `1px solid ${p.border}`, fontSize: 11, fontWeight: 700, color: p.color, whiteSpace: 'nowrap' }}>{t.who}</span>
                </div>
                {/* Items */}
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7, background: 'var(--card)' }}>
                  {t.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: p.bg, border: `1.5px solid ${p.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 10, fontWeight: 800, color: p.color }}>{j + 1}</div>
                      <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <Callout tone="info" icon="alert">
          {lang === 'th'
            ? <span><strong>กรณีย้ายผลตรวจไปยังผู้ป่วยรายใหม่</strong> ต้องแนบใบผลตรวจเดิมที่พิมพ์จาก E-Phis มาด้วยทุกครั้ง และกรุณาส่งแบบคำขอนี้กลับมาที่ห้องปฏิบัติการเพื่อทำการแก้ไข</span>
            : <span><strong>For transferring a result to a different patient</strong>, always attach the original E-Phis printout, then return the completed form to the laboratory for the correction.</span>}
        </Callout>
      </Section>
    </>
  )
}
