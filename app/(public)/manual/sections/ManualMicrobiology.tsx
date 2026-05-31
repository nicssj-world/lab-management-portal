import { H2, Section } from '../_primitives'
import type { Lang } from '../data'

interface Props { lang: Lang }

// ── Data ─────────────────────────────────────────────────────────────────────

const LABEL_ROWS = [
  { container: 'หลอดใส่ swab',                                      icon: '🧪', placement: 'ยาวหลอด',    placementEn: 'Lengthwise'  },
  { container: 'ขวดพลาสติกเก็บปัสสาวะ / เสมหะ',                     icon: '🧴', placement: 'ขวางบนฝา',   placementEn: 'Top wrap'    },
  { container: 'สไลด์',                                              icon: '🔬', placement: 'ซ้ายกระจกฝ้า', placementEn: 'Frosted end' },
  { container: 'ขวดแก้วมีฝาปิด',                                     icon: '🫙', placement: 'ขวางบนฝา',   placementEn: 'Top wrap'    },
  { container: 'กระบอกฉีดยา (syringe)',                              icon: '💉', placement: 'ยาวหลอด',    placementEn: 'Lengthwise'  },
  { container: 'ขวดเพาะเชื้อแบบอัตโนมัติ',                          icon: '🧫', placement: 'ยาว/ขวาง*',  placementEn: 'Any / no base' },
]

const LABEL_INSTRUCTIONS = [
  'ติดตามยาวหลอด ต่ำกว่าฝาปิด ให้เหลือช่องว่างให้เห็นภายในหลอด',
  'ติดตามขวางด้านบนต่ำกว่าฝาปิด ให้เหลือช่องว่างให้เห็นภายในขวด',
  'ติดฝั่งซ้ายบริเวณกระจกฝ้า ด้านเดียวกับที่ป้ายสิ่งตัวอย่าง',
  'ติดตามขวางด้านบนต่ำกว่าฝาปิด ให้เหลือช่องว่างให้เห็นภายในขวด',
  'ติดตามยาวหลอด หรือตามขวางชิดด้าม ให้เหลือช่องว่างให้เห็นภายใน',
  'ติดตามยาวหรือขวาง ระวังอย่าให้ทับ barcode ห้ามปิดทับก้นขวด',
]

// max 7 days — used for bar width calculation
const STORAGE_ITEMS = [
  { label: 'สิ่งตัวอย่างส่งตรวจทุกชนิด',                          days: 4, temp: '2–8°C',        cold: true,  group: 0 },
  { label: 'สไลด์ย้อมทุกชนิด (ยกเว้น India ink / KOH)',            days: 3, temp: 'อุณหภูมิห้อง', cold: false, group: 0 },
  { label: 'น้ำไขสันหลัง',                                         days: 7, temp: 'อุณหภูมิห้อง', cold: false, group: 0 },
  { label: 'เชื้อแบคทีเรียที่แยกได้ (สิ่งตัวอย่างทุกชนิด)',        days: 5, temp: '2–8°C',        cold: true,  group: 1 },
]
const MAX_DAYS = 7

interface ReportRow {
  group?: string
  test?: string
  critical?: boolean
  preliminary?: boolean
  complete?: boolean
}
const REPORT_ROWS: ReportRow[] = [
  { group: 'แบคทีเรีย' },
  { test: 'Gram stain — CSF / Body fluid',                        critical: true,                     complete: true },
  { test: 'Gram stain — สิ่งตัวอย่างส่งตรวจอื่นๆ',                                                   complete: true },
  { test: 'AFB — สิ่งตัวอย่างส่งตรวจจากระบบทางเดินหายใจ',         critical: true,                     complete: true },
  { test: 'AFB — สิ่งตัวอย่างส่งตรวจอื่นๆ',                                                          complete: true },
  { test: 'Modified AFB',                                                                              complete: true },
  { test: 'Culture & identification — Hemoculture',                critical: true, preliminary: true,  complete: true },
  { test: 'Culture & identification — สิ่งตัวอย่างส่งตรวจอื่นๆ',                  preliminary: true, complete: true },
  { test: 'Antimicrobial susceptibility test',                                                         complete: true },
  { group: 'เชื้อรา' },
  { test: 'India ink',                                                                                 complete: true },
  { test: 'KOH — สิ่งตัวอย่างส่งตรวจจาก sterile site',                                               complete: true },
  { test: 'KOH — สิ่งตัวอย่างส่งตรวจอื่นๆ',                                                          complete: true },
  { group: 'มัยโคแบคทีเรีย' },
  { test: 'AFB',                                                                                       complete: true },
  { test: 'Culture & identification',                                               preliminary: true, complete: true },
  { test: 'Antimicrobial susceptibility test',                                                         complete: true },
]

const GROUP_META: Record<string, { color: string; bg: string; stripe: string; emoji: string }> = {
  'แบคทีเรีย':       { color: '#1E5FAD', bg: 'rgba(30,95,173,.07)',   stripe: 'rgba(30,95,173,.18)',  emoji: '🦠' },
  'เชื้อรา':         { color: '#92400E', bg: 'rgba(217,119,6,.07)',    stripe: 'rgba(217,119,6,.2)',   emoji: '🍄' },
  'มัยโคแบคทีเรีย':  { color: '#5B21B6', bg: 'rgba(109,40,217,.06)',   stripe: 'rgba(109,40,217,.16)', emoji: '🔴' },
}

// ── Component ────────────────────────────────────────────────────────────────

export function ManualMicrobiology({ lang }: Props) {
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          1. CONTAINER LABELLING — specimen taxonomy grid
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H2 eyebrow="Microbiology">
          {lang === 'th' ? 'การใช้บริการห้องจุลชีววิทยา' : 'Microbiology Laboratory Service'}
        </H2>

        {/* Section sub-header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {lang === 'th' ? 'การติดป้ายบนภาชนะเก็บสิ่งตัวอย่างส่งตรวจ' : 'Specimen Container Labelling'}
          </h3>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, padding: '3px 10px', background: 'var(--surface-2)', borderRadius: 20, border: '1px solid var(--border)' }}>
            {LABEL_ROWS.length} ประเภทภาชนะ
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {LABEL_ROWS.map((r, i) => (
            <div key={i} style={{
              position: 'relative', overflow: 'hidden',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 11,
              padding: '14px 13px 12px',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(8,145,178,.4)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(8,145,178,.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              {/* Specimen number */}
              <div style={{
                position: 'absolute', top: 10, right: 11,
                fontSize: 10, fontWeight: 800, color: 'rgba(8,145,178,.35)',
                letterSpacing: '.08em', fontVariantNumeric: 'tabular-nums',
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>

              {/* Icon + placement tag row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(8,145,178,.08)',
                  border: '1px solid rgba(8,145,178,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {r.icon}
                </div>
                <div style={{
                  padding: '2px 8px', borderRadius: 5,
                  background: 'rgba(8,145,178,.08)',
                  border: '1px solid rgba(8,145,178,.2)',
                  fontSize: 10.5, fontWeight: 800, color: '#0891B2',
                  letterSpacing: '.02em', whiteSpace: 'nowrap',
                }}>
                  📍 {lang === 'th' ? r.placement : r.placementEn}
                </div>
              </div>

              {/* Container name */}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.35 }}>
                {r.container}
              </div>

              {/* Instruction */}
              <div style={{
                fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6,
                paddingTop: 7, borderTop: '1px dashed var(--border)',
              }}>
                {LABEL_INSTRUCTIONS[i]}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          2. STORAGE TIMES — visual duration bars
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {lang === 'th' ? 'ระยะเวลาที่เก็บสิ่งตัวอย่างส่งตรวจและเชื้อจุลชีพ' : 'Specimen & Organism Retention Times'}
          </h3>
          {/* Day ruler */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[1,2,3,4,5,6,7].map(d => (
              <div key={d} style={{ width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{d}</div>
            ))}
            <span style={{ fontSize: 10.5, color: 'var(--muted)', marginLeft: 4, fontWeight: 600 }}>วัน</span>
          </div>
        </div>

        {/* Group 0 header */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
          {lang === 'th' ? 'สิ่งตัวอย่างส่งตรวจ / สไลด์' : 'Specimens & Slides'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {STORAGE_ITEMS.filter(s => s.group === 0).map((item, i) => (
            <StorageBar key={i} item={item} maxDays={MAX_DAYS} lang={lang} />
          ))}
        </div>

        {/* Group 1 header */}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#0891B2', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0891B2' }} />
          {lang === 'th' ? 'เชื้อจุลชีพที่แยกได้' : 'Isolated Organisms'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {STORAGE_ITEMS.filter(s => s.group === 1).map((item, i) => (
            <StorageBar key={i} item={item} maxDays={MAX_DAYS} lang={lang} accent="#0891B2" />
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          3. REPORTING — heatmap matrix + principles
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          {lang === 'th' ? 'การรายงานผลการตรวจเพาะเชื้อและแยกเชื้อ' : 'Culture & Identification Reporting'}
        </h3>

        {/* Reporting principles — horizontal scroll pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {([
            { icon: '🖥', tone: 'neutral', text: lang === 'th' ? 'ผลการตรวจทั้งหมด รายงานผ่านระบบสารสนเทศโรงพยาบาล (ยกเว้นกรณีไม่รับสิ่งส่งตรวจเข้าระบบ HIS)' : 'All results reported via hospital HIS (except specimens not entered).' },
            { icon: '🏥', tone: 'neutral', text: lang === 'th' ? 'โรงพยาบาลภายนอก: รับผลได้ที่สำนักงาน กลุ่มงานฯ ชั้น 3 (เวลาราชการ) หรือโทรสาร — โทร. 038-931463' : 'External hospitals: collect at MT Office, 3rd Fl. (office hours) or fax 038-931463.' },
            { icon: '⚡', tone: 'critical', text: lang === 'th' ? 'ผลวิกฤติ — งานจุลชีววิทยาจะโทรแจ้งแพทย์ทันที เช่น เพาะเชื้อจากเลือดให้ผลบวก' : 'Critical results (e.g. positive blood culture) — phoned to physician immediately.' },
          ] as { icon: string; tone: string; text: string }[]).map((p, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '9px 12px',
              background: p.tone === 'critical' ? 'rgba(220,38,38,.05)' : 'var(--card)',
              border: `1px solid ${p.tone === 'critical' ? 'rgba(220,38,38,.2)' : 'var(--border)'}`,
              borderLeft: `3px solid ${p.tone === 'critical' ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 8,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{p.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{p.text}</span>
            </div>
          ))}
        </div>

        {/* Heatmap matrix */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Column header band */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              {lang === 'th' ? 'การทดสอบ' : 'Test'}
            </div>
            {[
              { label: lang === 'th' ? 'วิกฤติ' : 'Critical', bg: 'rgba(220,38,38,.12)', color: '#B91C1C', icon: '⚡' },
              { label: lang === 'th' ? 'เบื้องต้น' : 'Prelim.', bg: 'rgba(217,119,6,.1)',  color: '#92400E', icon: '◑' },
              { label: lang === 'th' ? 'สมบูรณ์' : 'Final',  bg: 'rgba(22,163,74,.1)',   color: '#065F46', icon: '✓' },
            ].map(col => (
              <div key={col.label} style={{
                padding: '9px 4px', textAlign: 'center',
                background: col.bg, borderLeft: '1px solid var(--border)',
                fontSize: 10.5, fontWeight: 800, color: col.color, letterSpacing: '.04em',
              }}>
                <div style={{ fontSize: 13, marginBottom: 1 }}>{col.icon}</div>
                {col.label}
              </div>
            ))}
          </div>

          {/* Rows */}
          {REPORT_ROWS.map((r, i) => {
            if (r.group) {
              const m = GROUP_META[r.group] ?? { color: 'var(--muted)', bg: 'var(--surface-2)', stripe: 'var(--border)', emoji: '●' }
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 14px',
                  background: m.bg,
                  borderTop: i > 0 ? `1px solid ${m.stripe}` : 'none',
                  borderBottom: `1px solid ${m.stripe}`,
                }}>
                  <span style={{ fontSize: 14 }}>{m.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: m.color, letterSpacing: '.07em', textTransform: 'uppercase' }}>{r.group}</span>
                </div>
              )
            }

            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                borderBottom: '1px solid var(--border)',
                transition: 'background .1s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ padding: '9px 14px 9px 22px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, display: 'flex', alignItems: 'center' }}>
                  {r.test}
                </div>
                {/* Critical */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderLeft: '1px solid var(--border)',
                  background: r.critical ? 'rgba(220,38,38,.07)' : undefined,
                }}>
                  {r.critical && (
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: 'var(--danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 900, color: '#fff',
                      boxShadow: '0 1px 4px rgba(220,38,38,.4)',
                    }}>⚡</div>
                  )}
                </div>
                {/* Preliminary */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderLeft: '1px solid var(--border)',
                  background: r.preliminary ? 'rgba(217,119,6,.06)' : undefined,
                }}>
                  {r.preliminary && (
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: '#D97706',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, color: '#fff',
                    }}>◑</div>
                  )}
                </div>
                {/* Complete */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderLeft: '1px solid var(--border)',
                  background: r.complete ? 'rgba(22,163,74,.05)' : undefined,
                }}>
                  {r.complete && (
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: 'var(--success)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, color: '#fff',
                    }}>✓</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend + footnotes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {[
            { icon: '⚡', color: 'var(--danger)', label: lang === 'th' ? 'วิกฤติ — รายงานทันทีเมื่อผลบวก' : 'Critical — report immediately on positive' },
            { icon: '◑', color: '#D97706', label: lang === 'th' ? 'เบื้องต้น — รายงานผลเบื้องต้นก่อน' : 'Preliminary result reported first' },
            { icon: '✓', color: 'var(--success)', label: lang === 'th' ? 'สมบูรณ์ — ผล identify + ความไวยา ใน 12–24 ชม.' : 'Final — ID + susceptibility within 12–24 h' },
          ].map(l => (
            <div key={l.icon} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900, flexShrink: 0 }}>{l.icon}</div>
              {l.label}
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--muted)' }}>
            {lang === 'th' ? 'สอบถาม' : 'Enquiries'}{' '}
            <strong style={{ color: 'var(--primary)' }}>โทร. 1463</strong>
          </div>
        </div>

        {/* Footnotes */}
        <div style={{
          marginTop: 8,
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {[
            {
              mark: '*',
              th: 'รายงานเฉพาะกรณีที่ให้ผลบวกในการทดสอบ',
              en: 'Reported only when the test result is positive.',
            },
            {
              mark: '**',
              th: 'Urgent report ทำเฉพาะกรณีที่ให้ผลบวกครั้งแรกในการทดสอบ — สอบถามข้อมูลเพิ่มเติม โทรศัพท์ 1463',
              en: 'Urgent report issued only on the first positive result — enquiries: ext. 1463.',
            },
            {
              mark: '***',
              th: 'ตัวอย่างที่ให้ผลบวกในการเพาะเชื้อทุกชนิด ห้องปฏิบัติการจะทำการ Identify และรายงานผลภายใน 12–24 ชั่วโมง จากนั้นหากมีผลการทดสอบความไวยา จะถูกรายงานตามมาในอีก 12–24 ชั่วโมง',
              en: 'All culture-positive specimens: laboratory will Identify and report within 12–24 h; antimicrobial susceptibility results follow within a further 12–24 h.',
            },
          ].map((fn, i, arr) => (
            <div key={fn.mark} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '8px 12px',
              background: i % 2 === 0 ? 'var(--bg)' : 'var(--card)',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{
                flexShrink: 0,
                minWidth: 26, textAlign: 'right',
                fontSize: 11, fontWeight: 800,
                color: 'var(--muted)',
                fontFamily: '"IBM Plex Mono", monospace',
                paddingTop: 1,
                letterSpacing: '.02em',
              }}>
                {fn.mark}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                {lang === 'th' ? fn.th : fn.en}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

// ── Storage bar sub-component ─────────────────────────────────────────────────

function StorageBar({ item, maxDays, lang, accent = 'var(--primary)' }: {
  item: { label: string; days: number; temp: string; cold: boolean }
  maxDays: number
  lang: Lang
  accent?: string
}) {
  const pct = Math.round((item.days / maxDays) * 100)
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 9,
      background: 'var(--card)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      {/* Label + temp + days */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, flex: 1, minWidth: 0, lineHeight: 1.45 }}>{item.label}</span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: item.cold ? 'rgba(8,145,178,.09)' : 'rgba(217,119,6,.09)', color: item.cold ? '#0891B2' : '#92400E', border: `1px solid ${item.cold ? 'rgba(8,145,178,.2)' : 'rgba(217,119,6,.2)'}` }}>
            {item.cold ? '❄' : '🌡'} {item.temp}
          </span>
          <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 800, background: `${accent}12`, color: accent, border: `1px solid ${accent}25`, minWidth: 42, textAlign: 'center' }}>
            {item.days} {lang === 'th' ? 'วัน' : 'd'}
          </span>
        </div>
      </div>
      {/* Bar */}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: accent, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}
