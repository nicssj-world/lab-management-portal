'use client'

import { useState } from 'react'
import { H2, Callout, Section } from '../_primitives'
import { type Lang } from '../data'

interface Props { lang: Lang }

// ── Data ──────────────────────────────────────────────────────────────────────

const REJECTION_RULES = [
  { th: 'ฉลากไม่ครบหรือไม่ชัดเจน',              en: 'Missing or illegible label',       bodyTh: 'ตัวชี้บ่งอย่างน้อย 2 รายการ: (1) ชื่อ-สกุล และ (2) วันเดือนปีเกิด / HN. / Lab ID', bodyEn: 'At least 2 identifiers: (1) full name and (2) DOB or HN or Lab ID.' },
  { th: 'ข้อมูลใบนำส่งกับภาชนะไม่ตรงกัน',       en: 'Form ↔ container mismatch',        bodyTh: 'ชื่อ-สกุล HN. หรือ LAB ID ของใบนำส่งกับภาชนะบรรจุไม่ตรงกัน',                     bodyEn: 'Patient name, HN, or LAB ID differs between request form and container.' },
  { th: 'ปริมาตรไม่ได้ตามเกณฑ์',                en: 'Volume off-spec',                  bodyTh: 'เช่น PT/PTT/ESR ต้องใส่เลือดให้ถึงขีดข้างหลอดพอดี',                               bodyEn: 'e.g., PT, PTT, ESR must fill exactly to the tube indicator line.' },
  { th: 'ใช้ภาชนะผิดประเภท',                    en: 'Wrong container type',             bodyTh: 'เช่น ส่ง Electrolyte ในหลอด Clotted แทน Li-Heparin หรือ Urine culture ในกระป๋องไม่ Sterile', bodyEn: 'e.g., Electrolyte in Clotted (red) instead of Li-Heparin (green).' },
  { th: 'ตัวอย่างไม่เหมาะสมสำหรับการตรวจวิเคราะห์', en: 'Specimen unsuitable for analysis', bodyTh: 'Hemolyzed ≥ 3+ · Fibrin clot (CBC/PT/PTT/ABG) · เก็บผิดวิธี · หกปนเปื้อน · ข้นหนืดเกินดูดวัด', bodyEn: 'Hemolysis ≥ 3+, fibrin clot, wrong material, leaked, too viscous.' },
  { th: 'นำส่งไม่ถูกวิธี',                        en: 'Improper transport',               bodyTh: 'เช่น ABG ที่ไม่ใช้ ice pack · Microbilirubin (เด็ก) ที่ไม่ห่อกระดาษทึบ',           bodyEn: 'e.g., ABG without ice pack, pediatric microbilirubin not light-protected.' },
]

const TEMP_WINDOWS = [
  { icon: '🌡', label: 'Room temp',       range: '20–25 °C', tests: 'CBC · BUN · Cr · LFT · Glucose (NaF)',  window: '≤ 2 hr',   color: '#D97706', bg: 'rgba(217,119,6,.08)',  border: 'rgba(217,119,6,.22)' },
  { icon: '❄',  label: 'Refrigerated',    range: '2–8 °C',   tests: ' Alcohol (ethanol), Aldosterone (Blood), BRCA1/2',        window: '≤ 24 hr',  color: '#0891B2', bg: 'rgba(8,145,178,.08)', border: 'rgba(8,145,178,.22)' },
  { icon: '🧊', label: 'Ice pack',        range: '0–4 °C',   tests: 'ABG · NH₃ · Lactate · Renin',           window: '≤ 30 min', color: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.22)' },
  { icon: '🔆', label: 'Light-protected', range: 'Room',     tests: 'Microbilirubin (เด็ก) — ห่อฟอยล์',     window: '≤ 2 hr',   color: '#7E22CE', bg: 'rgba(126,34,206,.07)', border: 'rgba(126,34,206,.2)' },
]

const STAT_STEPS = [
  { th: 'แพทย์ พยาบาล หรือผู้รับบริการ โทรประสานกับนักเทคนิคการแพทย์ พร้อมบันทึก Request Lab ในระบบ HIS', en: 'Physician, nurse, or submitter phones the on-duty MT and submits the Lab Request in HIS.' },
  { th: 'จัดเก็บและนำส่งสิ่งตัวอย่างยังห้องปฏิบัติการเทคนิคการแพทย์โดยเร็ว', en: 'Collect and deliver the specimen to the Medical Technology lab without delay.' },
  { th: 'นักเทคนิคการแพทย์ลงทะเบียนรับ ตรวจสอบ และดำเนินการตรวจวิเคราะห์ + รายงานผลกรณีเร่งด่วนก่อน', en: 'MT registers, verifies, and performs analysis + reporting as STAT priority.' },
]

const NIPT_TUBE_RULES = [
  'หลอดเก็บเลือดต้องเป็นชนิด Cowin tube หรือ Streck tube เท่านั้น โดยปริมาณเลือดที่ยอมรับได้ต่ำสุด คืออย่างน้อย 8 มิลลิลิตร',
  'สิ่งส่งตรวจที่ส่งมาต้องถูกควบคุมอุณหภูมิในช่วง 6–35 °C',
  'หลังปั่นแยกพลาสมาแล้ว หากพบภาวะเม็ดเลือดแดงแตกรุนแรง (severe hemolysis), ไขมันสูง (lipidemia), บิลลิรูบินสูง (hyperbilirubinemia) หรือพบการปนเปื้อนของเชื้อจุลชีพ (bacterial contamination) ให้ดำเนินการปฏิเสธสิ่งส่งตรวจ',
  'สิ่งส่งตรวจขนส่งมาในอุณหภูมิที่ไม่เหมาะสม หรือใช้ภาชนะบรรจุที่ไม่ได้รับการรับรอง ผิดประเภท หรือหมดอายุแล้ว ให้ปฏิเสธสิ่งส่งตรวจ',
]

const NIPT_REQUIRE_SIGNATURE = [
  'ตัวอย่างที่ถูกส่งมาถึงห้องปฏิบัติการเกินกว่า 96 ชั่วโมง แต่ไม่เกิน 7 วัน',
  'ผู้รับบริการมีอายุครรภ์น้อยกว่า 10 สัปดาห์ หรือเกิน 20 สัปดาห์',
  'ผู้รับบริการที่มี BMI มากกว่า 40',
  'ผู้รับบริการมีประวัติเป็นเนื้องอก สามารถส่งตรวจได้แต่ต้องได้รับคำปรึกษาจากแพทย์ก่อนส่งตรวจ (Pre-test counseling) และลงนามในเอกสารยินยอมรับการตรวจคัดกรอง CBH-NIPT (Fm-WI-T-BM17-02)',
]

const NIPT_ACCEPT_WITH_CONDITION = [
  'ผู้รับบริการที่ได้รับการรักษาด้วย Heparin ต้องได้รับครั้งสุดท้ายนานกว่า 24 ชั่วโมง ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'ผู้รับบริการที่ได้รับ Human serum albumin therapy ต้องรับครั้งสุดท้ายนานกว่า 4 สัปดาห์ ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'ผู้รับบริการที่ได้รับการรักษาด้วย Exogeneous DNA cells introduced immunotherapy หรือยาที่มีสาเหตุทำให้ DNA mutation ต้องได้รับการฉีดครั้งสุดท้ายไม่น้อยกว่า 4 สัปดาห์ ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'ผู้รับบริการที่ได้รับการเปลี่ยนถ่ายเลือด (Allogenic blood transfusion) ภายใน 1 ปี ต้องได้รับการเปลี่ยนถ่ายเลือดครั้งสุดท้ายนานกว่า 1 ปี ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'กรณีเป็น Vanishing Twin Syndrome ตัวอ่อนที่ฝ่อไปแล้ว จะต้องฝ่อก่อนอายุครรภ์ครบ 8 สัปดาห์ และต้องนับต่อจากวันที่ตัวอ่อนฝ่อไปอีก 8 สัปดาห์ จึงจะสามารถเจาะเลือดตรวจ NGS-NIPT ได้',
]

const NIPT_REQUIRE_HISTORY = [
  'ผู้รับบริการที่ใช้เทคโนโลยีเจริญพันธุ์ต่างๆ',
  'ผู้รับบริการที่มีประวัติโรคทางพันธุกรรมเกิดขึ้นกับครอบครัว',
  'ผู้รับบริการที่มีประวัติความผิดปกติของระบบสืบพันธุ์',
  'ผู้รับบริการที่มีประวัติการตั้งครรภ์ผิดปกติมาก่อน หรือเคยตรวจคัดกรองทารกด้วยวิธีอื่นมาก่อนและพบความผิดปกติ',
]

const NIPT_REJECT = [
  'สิ่งส่งตรวจที่ข้อมูลไม่ชัดเจน ไม่มีชื่อหรือใบขอตรวจ ข้อมูลบนหลอดเก็บเลือดและใบขอตรวจไม่ตรงกัน',
  'สิ่งส่งตรวจที่เม็ดเลือดแดงแตกรุนแรง (Severe hemolysis), มีไขมันในเลือดสูง, เลือดแข็งตัวในหลอดตัวอย่าง หรือมีการปนเปื้อนของเชื้อจุลชีพในสิ่งส่งตรวจ รวมถึงคนไข้ติดเชื้อในกระแสเลือด',
  'สิ่งส่งตรวจที่มีปริมาณไม่เพียงพอ หรือพบภาวะรั่วซึม หรือหกออกมานอกภาชนะเก็บสิ่งส่งตรวจ',
  'สิ่งส่งตรวจขนส่งมาในอุณหภูมิที่ไม่เหมาะสม หรือใช้ภาชนะบรรจุที่ไม่ได้รับการรับรอง ผิดประเภท หรือหมดอายุแล้ว',
  'สิ่งส่งตรวจถึงห้องปฏิบัติการเกินกว่า 7 วัน',
  'ผู้รับบริการมีความผิดปกติของ Karyotype, Chromosome aneuploidy, Sex chromosome aneuploidy (SCA), chromosomal microdeletion / microduplication syndrome และ maternal, fetal or placental mosaicism',
  'การตั้งครรภ์แฝดสามหรือมากกว่า',
  'ทารกในครรภ์แฝดอย่างน้อย 1 คน มีพัฒนาการการเจริญเติบโตที่บกพร่อง',
  'ผู้รับบริการที่เป็นหรือมีประวัติมะเร็ง, malignant tumor, benign tumor มาก่อน (ยกเว้น benign uterine fibroid)',
]

const TABS = [
  { id: 'general', th: 'การส่งตรวจทั่วไป', en: 'General Transport' },
  { id: 'nipt',    th: 'NGS: NIPT',         en: 'NGS: NIPT'        },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function NiptSection({ title, badge, badgeColor, badgeBg, items, note }: {
  title: string; badge: string; badgeColor: string; badgeBg: string; items: string[]; note?: string
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      {/* Category header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: '8px 8px 0 0',
        background: badgeBg, border: `1px solid ${badgeColor}30`,
        borderBottom: 'none',
      }}>
        <span style={{ padding: '2px 9px', borderRadius: 5, background: badgeColor, color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '.02em' }}>{badge}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: badgeColor }}>{title}</span>
      </div>
      {/* Items */}
      <div style={{ border: `1px solid ${badgeColor}25`, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        {note && (
          <div style={{ padding: '9px 14px', background: badgeBg, borderBottom: `1px solid ${badgeColor}20`, fontSize: 12.5, color: badgeColor, lineHeight: 1.6 }}>
            {note}
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '10px 14px',
            background: i % 2 === 0 ? 'var(--card)' : 'var(--bg)',
            borderBottom: i < items.length - 1 ? `1px solid ${badgeColor}15` : 'none',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 10.5, marginTop: 1,
              background: badgeBg, border: `1.5px solid ${badgeColor}40`, color: badgeColor,
            }}>{i + 1}</div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ManualTransport({ lang }: Props) {
  const [tab, setTab] = useState('general')

  return (
    <Section>
      <H2 eyebrow="03 · Transport & Rejection">
        {lang === 'th' ? 'การส่งตัวอย่างส่งตรวจ' : 'Specimen Transport'}
      </H2>

      {/* ── Pill tab switcher ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 6, marginBottom: 22, padding: '4px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
        {TABS.map(t => {
          const active = t.id === tab
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '7px 18px', borderRadius: 7, border: 'none',
                background: active ? 'var(--card)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 500, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                transition: 'all .15s', lineHeight: 1.25,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--muted)' }}
            >
              {lang === 'th' ? t.th : t.en}
            </button>
          )
        })}
      </div>

      {/* ════════════════════════ GENERAL TAB ════════════════════════════ */}
      {tab === 'general' && (
        <>
          {/* Biohazard notice */}
          <div style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'rgba(22,163,74,.05)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 9, marginBottom: 20 }}>
            <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>🧬</span>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
              {lang === 'th'
                ? 'สิ่งตัวอย่างส่งตรวจทุกชนิดต้องบรรจุในถุง biohazard ปิดสนิท ใบส่งตรวจอยู่ในช่องด้านนอกของถุง ไม่ปะปนกับตัวอย่าง และจัดส่งห้องปฏิบัติการโดยเร็วที่สุดในสภาวะที่เหมาะสม'
                : 'All specimens are sealed in biohazard bags; request forms travel in the outer pocket. Deliver to the lab as quickly as possible under the appropriate temperature condition.'}
            </p>
          </div>

          {/* Temperature windows */}
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            {lang === 'th' ? 'อุณหภูมิและระยะเวลาส่งตรวจ' : 'Temperature & Time Windows'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 8, marginBottom: 22 }}>
            {TEMP_WINDOWS.map(c => (
              <div key={c.label} style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden', background: 'var(--card)' }}>
                {/* Header strip */}
                <div style={{ padding: '10px 14px', background: c.bg, borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: c.color }}>{c.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: '"IBM Plex Mono",monospace', color: c.color, background: 'var(--card)', padding: '2px 8px', borderRadius: 5, border: `1px solid ${c.border}` }}>{c.range}</span>
                </div>
                {/* Body */}
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>{c.tests}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: c.bg, border: `1px solid ${c.border}`, fontSize: 11.5, fontWeight: 800, color: c.color }}>
                    ⏱ {c.window}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Rejection criteria */}
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            {lang === 'th' ? 'เกณฑ์การปฏิเสธสิ่งตัวอย่างส่งตรวจ' : 'Specimen Rejection Criteria'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 7, marginBottom: 22 }}>
            {REJECTION_RULES.map((r, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--danger)', borderRadius: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10.5, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? r.th : r.en}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>{lang === 'th' ? r.bodyTh : r.bodyEn}</p>
              </div>
            ))}
          </div>

          {/* STAT workflow */}
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            {lang === 'th' ? 'แนวทางการรับสิ่งตัวอย่างกรณีเร่งด่วน (STAT)' : 'Urgent (STAT) Specimen Flow'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STAT_STEPS.map((s, i) => {
              const isLast = i === STAT_STEPS.length - 1
              return (
                <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 38, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12.5, flexShrink: 0, zIndex: 1 }}>{i + 1}</div>
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 10, background: 'var(--border)', margin: '3px 0' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, marginLeft: 10, marginBottom: isLast ? 0 : 8, padding: '9px 13px', background: 'var(--card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 9, fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
                    {lang === 'th' ? s.th : s.en}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ════════════════════════ NIPT TAB ═══════════════════════════════ */}
      {tab === 'nipt' && (
        <>
          {/* NIPT intro banner */}
          <div style={{ padding: '13px 16px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>
              หลักเกณฑ์ในการรับหรือปฏิเสธสิ่งส่งตรวจ
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
              สำหรับการตรวจคัดกรองกลุ่มอาการดาวน์ ด้วยวิธี <strong>Next Generation Sequencing: Non-Invasive Prenatal Testing (NGS: NIPT)</strong>
            </div>
          </div>

          {/* Tube & transport requirements */}
          <NiptSection
            title="ข้อกำหนดหลอดเก็บเลือดและการขนส่ง"
            badge="📋 ข้อกำหนด"
            badgeColor="#0891B2"
            badgeBg="rgba(8,145,178,.08)"
            items={NIPT_TUBE_RULES}
          />

          <NiptSection
            title="กรณีที่ผู้รับบริการต้องลงนามยืนยันการขอตรวจ"
            badge="🖊 ลงนาม"
            badgeColor="#D97706"
            badgeBg="rgba(217,119,6,.08)"
            items={NIPT_REQUIRE_SIGNATURE}
            note="ทางห้องปฏิบัติการจะไม่ดำเนินการทดสอบจนกว่าจะได้รับเอกสารดังกล่าว"
          />

          <NiptSection
            title="สามารถรับสิ่งส่งตรวจได้ แต่ต้องตรวจสอบเงื่อนไขก่อนเจาะเลือดตรวจ NIPT"
            badge="✅ ตรวจสอบก่อน"
            badgeColor="var(--primary)"
            badgeBg="var(--primary-soft)"
            items={NIPT_ACCEPT_WITH_CONDITION}
          />

          <NiptSection
            title="สามารถรับสิ่งส่งตรวจได้ แต่ต้องสืบค้นหรือขอประวัติเพิ่ม"
            badge="🔍 สืบค้นประวัติ"
            badgeColor="#065F46"
            badgeBg="rgba(22,163,74,.08)"
            items={NIPT_REQUIRE_HISTORY}
            note="คัดเลือกผู้รับบริการที่มีภูมิหลังเกี่ยวกับ chromosomal abnormality น้อยที่สุด หากพิจารณาแล้วเห็นว่ามีความเสี่ยงที่จะกระทบต่อผลตรวจ ให้ปฏิเสธสิ่งส่งตรวจ"
          />

          <NiptSection
            title="เงื่อนไขที่ต้องปฏิเสธสิ่งส่งตรวจ"
            badge="❌ ปฏิเสธ"
            badgeColor="var(--danger)"
            badgeBg="rgba(220,38,38,.07)"
            items={NIPT_REJECT}
          />

          <Callout tone="warning" icon="alert">
            หากพบเงื่อนไขที่ไม่แน่ใจ ให้ติดต่อคลินิกหรือโรงพยาบาลที่ส่งตรวจก่อนดำเนินการ
          </Callout>
        </>
      )}
    </Section>
  )
}
