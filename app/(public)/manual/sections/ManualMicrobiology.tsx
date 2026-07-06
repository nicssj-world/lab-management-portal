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

const MICRO_STYLE = `
  .micro-page {
    --micro: #0F766E;
    --micro-2: #0891B2;
    --micro-soft: rgba(15,118,110,.08);
    --micro-line: rgba(15,118,110,.18);
  }
  .micro-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
    margin: -4px 0 18px;
    padding: 14px;
    border: 1px solid var(--micro-line);
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(15,118,110,.09), rgba(8,145,178,.05));
  }
  .micro-hero-copy {
    margin: 0;
    font-size: 13px;
    line-height: 1.75;
    color: var(--muted);
  }
  .micro-hero-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(74px, 1fr));
    gap: 8px;
  }
  .micro-stat {
    min-width: 74px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,.72);
    border: 1px solid rgba(15,118,110,.14);
  }
  .micro-stat b {
    display: block;
    color: var(--micro);
    font-size: 17px;
    line-height: 1.05;
  }
  .micro-stat span {
    display: block;
    margin-top: 2px;
    color: var(--muted);
    font-size: 10.5px;
    font-weight: 700;
  }
  .micro-section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .micro-section-head h3 {
    margin: 0;
    color: var(--ink);
    font-size: 15px;
    font-weight: 800;
    line-height: 1.45;
  }
  .micro-section-head p {
    margin: 3px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.55;
  }
  .micro-count-pill {
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--micro-line);
    background: var(--micro-soft);
    color: var(--micro);
    font-size: 11.5px;
    font-weight: 800;
    white-space: nowrap;
  }
  .micro-label-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 10px;
  }
  .micro-label-card {
    position: relative;
    overflow: hidden;
    min-height: 168px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background:
      linear-gradient(180deg, rgba(255,255,255,.94), rgba(255,255,255,.78)),
      radial-gradient(circle at top left, rgba(15,118,110,.13), transparent 42%);
    transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
  }
  .micro-label-card:hover {
    border-color: var(--micro-line);
    box-shadow: 0 8px 18px rgba(15,23,42,.08);
    transform: translateY(-1px);
  }
  .micro-label-no {
    position: absolute;
    top: 12px;
    right: 13px;
    color: rgba(15,118,110,.26);
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .08em;
  }
  .micro-label-top {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding-right: 32px;
    margin-bottom: 11px;
  }
  .micro-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: rgba(8,145,178,.10);
    border: 1px solid rgba(8,145,178,.18);
    font-size: 22px;
  }
  .micro-placement {
    display: inline-flex;
    width: fit-content;
    max-width: 100%;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 7px;
    border: 1px solid rgba(8,145,178,.20);
    background: rgba(8,145,178,.08);
    color: #087F9A;
    font-size: 11px;
    font-weight: 800;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .micro-container {
    margin: 0 0 8px;
    color: var(--ink);
    font-size: 13.5px;
    font-weight: 800;
    line-height: 1.45;
  }
  .micro-instruction {
    margin: 0;
    padding-top: 9px;
    border-top: 1px dashed var(--border);
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
  }
  .micro-storage-head {
    align-items: center;
  }
  .micro-day-ruler {
    display: flex;
    gap: 3px;
    align-items: center;
  }
  .micro-day {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 10px;
    font-weight: 800;
  }
  .micro-report-scroll {
    width: 100%;
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .micro-report-table {
    min-width: 620px;
  }
  .micro-report-list {
    display: none;
  }
  .micro-report-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 0 7px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .micro-report-item {
    display: grid;
    gap: 8px;
    padding: 11px 12px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--card);
  }
  .micro-report-title {
    color: var(--ink);
    font-size: 13px;
    font-weight: 650;
    line-height: 1.55;
  }
  .micro-report-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .micro-report-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 24px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    line-height: 1.2;
  }
  @media (max-width: 640px) {
    .micro-hero {
      grid-template-columns: 1fr;
      padding: 12px;
    }
    .micro-hero-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .micro-section-head {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .micro-count-pill {
      width: fit-content;
    }
    .micro-label-grid {
      grid-template-columns: 1fr;
    }
    .micro-label-card {
      min-height: 0;
      padding: 13px;
    }
    .micro-day-ruler {
      width: 100%;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .micro-report-scroll {
      display: none;
    }
    .micro-report-list {
      display: grid;
      gap: 7px;
    }
    .micro-report-group:first-child {
      margin-top: 0;
    }
  }
`

// ── Component ────────────────────────────────────────────────────────────────

export function ManualMicrobiology({ lang }: Props) {
  return (
    <div className="micro-page">
      <style>{MICRO_STYLE}</style>
      {/* ══════════════════════════════════════════════════════════════════
          1. CONTAINER LABELLING — specimen taxonomy grid
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H2 eyebrow="Microbiology">
          {lang === 'th' ? 'การใช้บริการห้องจุลชีววิทยา' : 'Microbiology Laboratory Service'}
        </H2>

        <div className="micro-hero">
          <p className="micro-hero-copy">
            {lang === 'th'
              ? 'สรุปตำแหน่งการติดป้าย ภาชนะที่ใช้บ่อย ระยะเวลาเก็บสิ่งส่งตรวจ และรูปแบบการรายงานผล เพื่อให้เจ้าหน้าที่ตรวจสอบได้เร็วจากหน้าจอเดียว'
              : 'A quick reference for label placement, common containers, retention times, and reporting rules for microbiology specimens.'}
          </p>
          <div className="micro-hero-stats" aria-label={lang === 'th' ? 'ข้อมูลสรุป' : 'Summary'}>
            <div className="micro-stat">
              <b>{LABEL_ROWS.length}</b>
              <span>{lang === 'th' ? 'ภาชนะ' : 'containers'}</span>
            </div>
            <div className="micro-stat">
              <b>1463</b>
              <span>{lang === 'th' ? 'สอบถาม' : 'enquiry'}</span>
            </div>
          </div>
        </div>

        {/* Section sub-header */}
        <div className="micro-section-head">
          <div>
            <h3>{lang === 'th' ? 'การติดป้ายบนภาชนะเก็บสิ่งตัวอย่างส่งตรวจ' : 'Specimen Container Labelling'}</h3>
            <p>{lang === 'th' ? 'เลือกตำแหน่งติดป้ายให้เห็น specimen และ barcode ชัดเจน' : 'Keep the specimen and barcode visible after labelling.'}</p>
          </div>
          <span className="micro-count-pill">
            {LABEL_ROWS.length} ประเภทภาชนะ
          </span>
        </div>

        <div className="micro-label-grid">
          {LABEL_ROWS.map((r, i) => (
            <div key={i} className="micro-label-card">
              {/* Specimen number */}
              <div className="micro-label-no">
                {String(i + 1).padStart(2, '0')}
              </div>

              {/* Icon + placement tag row */}
              <div className="micro-label-top">
                <div className="micro-icon" aria-hidden="true">
                  {r.icon}
                </div>
                <div className="micro-placement">
                  📍 {lang === 'th' ? r.placement : r.placementEn}
                </div>
              </div>

              {/* Container name */}
              <div className="micro-container">
                {r.container}
              </div>

              {/* Instruction */}
              <div className="micro-instruction">
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
        <div className="micro-section-head micro-storage-head">
          <div>
            <h3>{lang === 'th' ? 'ระยะเวลาที่เก็บสิ่งตัวอย่างส่งตรวจและเชื้อจุลชีพ' : 'Specimen & Organism Retention Times'}</h3>
            <p>{lang === 'th' ? 'แถบสีเทียบจำนวนวันสูงสุดที่เก็บได้' : 'Bars compare maximum retention days.'}</p>
          </div>
          {/* Day ruler */}
          <div className="micro-day-ruler">
            {[1,2,3,4,5,6,7].map(d => (
              <div key={d} className="micro-day">{d}</div>
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
        <div className="micro-report-scroll">
        <div className="micro-report-table">
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
        </div>

        <div className="micro-report-list" aria-label={lang === 'th' ? 'รายการการรายงานผล' : 'Reporting list'}>
          {REPORT_ROWS.map((r, i) => {
            if (r.group) {
              const m = GROUP_META[r.group] ?? { color: 'var(--muted)', bg: 'var(--surface-2)', stripe: 'var(--border)', emoji: '●' }
              return (
                <div key={i} className="micro-report-group" style={{ color: m.color, background: m.bg, borderColor: m.stripe }}>
                  <span aria-hidden="true">{m.emoji}</span>
                  {r.group}
                </div>
              )
            }

            return (
              <div key={i} className="micro-report-item">
                <div className="micro-report-title">{r.test}</div>
                <ReportStatusBadges row={r} lang={lang} />
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
    </div>
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

function ReportStatusBadges({ row, lang }: { row: ReportRow; lang: Lang }) {
  const badges = [
    row.critical && {
      icon: '⚡',
      label: lang === 'th' ? 'วิกฤติ' : 'Critical',
      color: '#B91C1C',
      bg: 'rgba(220,38,38,.08)',
      border: 'rgba(220,38,38,.22)',
    },
    row.preliminary && {
      icon: '◑',
      label: lang === 'th' ? 'เบื้องต้น' : 'Preliminary',
      color: '#92400E',
      bg: 'rgba(217,119,6,.09)',
      border: 'rgba(217,119,6,.24)',
    },
    row.complete && {
      icon: '✓',
      label: lang === 'th' ? 'สมบูรณ์' : 'Final',
      color: '#065F46',
      bg: 'rgba(22,163,74,.09)',
      border: 'rgba(22,163,74,.24)',
    },
  ].filter(Boolean) as { icon: string; label: string; color: string; bg: string; border: string }[]

  if (badges.length === 0) return null

  return (
    <div className="micro-report-badges">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className="micro-report-badge"
          style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}
        >
          <span aria-hidden="true">{badge.icon}</span>
          {badge.label}
        </span>
      ))}
    </div>
  )
}
