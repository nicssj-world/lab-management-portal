import { useState, type CSSProperties } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Callout, Section } from '../_primitives'
import { MANUAL_SECTIONS, TEAM, PHONE_DIRECTORY, type TeamMember, type PhoneEntry, type Lang } from '../data'
import { useManualTable } from '../ManualTablesContext'
import { ManualTableEditor } from '@/components/manual/ManualTableEditor'
import { TABLE_SCHEMAS, type EditableRow } from '../tables'

interface Props {
  lang: Lang
  goto: (id: string) => void
}

const TEAM_TONE = {
  color: '#64748B',
  bg: 'rgba(100,116,139,.055)',
  border: 'rgba(100,116,139,.16)',
}

const SECTION_TONE = {
  color: '#1E5FAD',
  bg: 'rgba(30,95,173,.075)',
  border: 'rgba(30,95,173,.16)',
}

export function ManualHome({ lang, goto }: Props) {
  const [editingTeam, setEditingTeam] = useState(false)
  const team = useManualTable<TeamMember>('team', 'home', TEAM)
  const [editingPhone, setEditingPhone] = useState(false)
  const phone = useManualTable<PhoneEntry>('phoneDirectory', 'home', PHONE_DIRECTORY)
  return (
    <Section>
      <style>{`
        .manual-home {
          --manual-accent: #1E5FAD;
          --manual-accent-soft: rgba(30,95,173,.11);
          --manual-accent-border: rgba(30,95,173,.24);
          --manual-gold: #B08D57;
          --manual-shadow-sm: 0 8px 20px rgba(15,23,42,.055);
          --manual-shadow-md: 0 16px 38px rgba(15,23,42,.09);
          --primary: #1E5FAD;
          --primary-soft: rgba(30,95,173,.11);
          position: relative;
          margin: -4px;
          padding: 20px;
          border-radius: 16px;
          overflow: hidden;
          background:
            radial-gradient(circle at 92% 4%, rgba(30,95,173,.14), transparent 28%),
            radial-gradient(circle at 5% 100%, rgba(176,141,87,.12), transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,.92), rgba(248,251,255,.74));
          border: 1px solid rgba(30,95,173,.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.82);
        }
        .manual-home::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(30,95,173,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30,95,173,.035) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: linear-gradient(135deg, rgba(0,0,0,.44), transparent 72%);
          pointer-events: none;
        }
        .manual-home > * {
          position: relative;
          z-index: 1;
        }
        .manual-home-hero {
          padding: 2px 0 4px;
        }
        .manual-home-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.76);
          border: 1px solid rgba(30,95,173,.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.82), var(--manual-shadow-sm);
        }
        .manual-team-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(4, auto);
          grid-auto-flow: column;
          gap: 8px;
        }
        .manual-stat-card,
        .manual-info-card,
        .manual-team-card,
        .manual-section-link,
        .manual-pdf-card {
          box-shadow: var(--manual-shadow-sm), inset 0 1px 0 rgba(255,255,255,.76);
        }
        .manual-stat-card {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(255,255,255,.95), var(--stat-tone-soft, rgba(255,255,255,.72))) !important;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }
        .manual-stat-card::after {
          content: "";
          position: absolute;
          inset: auto -24px -28px auto;
          width: 86px;
          height: 86px;
          border-radius: 50%;
          background: currentColor;
          opacity: .06;
          pointer-events: none;
        }
        .manual-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--manual-shadow-md), inset 0 1px 0 rgba(255,255,255,.86);
        }
        .manual-section-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .manual-section-title::before {
          content: "";
          width: 6px;
          height: 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, var(--manual-accent), var(--manual-gold));
          box-shadow: 0 6px 14px rgba(30,95,173,.18);
        }
        .manual-info-card {
          background: rgba(255,255,255,.84) !important;
          border-color: rgba(30,95,173,.13) !important;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }
        .manual-team-card {
          background: linear-gradient(135deg, rgba(255,255,255,.90), var(--team-tone-soft, rgba(255,255,255,.76))) !important;
          border-color: var(--team-tone-border, rgba(30,95,173,.13)) !important;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }
        .manual-info-card:hover,
        .manual-team-card:hover {
          transform: translateY(-1px);
          border-color: var(--team-tone, rgba(30,95,173,.24)) !important;
          box-shadow: var(--manual-shadow-md), inset 0 1px 0 rgba(255,255,255,.86);
        }
        .manual-team-icon {
          background: rgba(100,116,139,.10) !important;
          border: 1px solid rgba(100,116,139,.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.84);
        }
        .manual-section-icon {
          background: rgba(30,95,173,.10) !important;
          border: 1px solid rgba(30,95,173,.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.84);
        }
        .manual-pdf-icon {
          background: linear-gradient(135deg, var(--manual-accent), #0E3F7E) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 10px 22px rgba(30,95,173,.22);
        }
        @media (max-width: 760px) {
          .manual-team-grid {
            grid-template-columns: 1fr;
            grid-template-rows: none;
            grid-auto-flow: row;
          }
          .manual-home {
            margin: -8px;
            padding: 14px;
          }
        }
        .manual-section-index {
          transition: color .15s ease, opacity .15s ease;
        }
        .manual-section-link {
          border-color: var(--section-tone-border, rgba(30,95,173,.13)) !important;
          background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(255,255,255,.76)) !important;
          box-shadow: var(--manual-shadow-sm), inset 0 1px 0 rgba(255,255,255,.78) !important;
          transition:
            transform .18s ease,
            border-color .18s ease,
            background .18s ease,
            box-shadow .22s ease !important;
        }
        .manual-section-link:hover,
        .manual-section-link:focus-visible {
          border-color: var(--section-tone, var(--manual-accent)) !important;
          background: linear-gradient(135deg, var(--section-tone-soft, rgba(30,95,173,.13)), rgba(255,255,255,.90) 58%, rgba(176,141,87,.08)) !important;
          transform: translateY(-2px);
          box-shadow: var(--manual-shadow-md), inset 0 1px 0 rgba(255,255,255,.88) !important;
        }
        .manual-section-link:hover .manual-section-index {
          color: var(--section-tone, var(--manual-accent)) !important;
          opacity: .18 !important;
        }
        .manual-section-link:hover .manual-section-icon,
        .manual-section-link:focus-visible .manual-section-icon {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.26), 0 12px 26px rgba(15,23,42,.22);
        }
        .manual-pdf-card {
          background: linear-gradient(135deg, rgba(30,95,173,.12), rgba(255,255,255,.88) 44%, rgba(30,95,173,.06)) !important;
          border-color: rgba(30,95,173,.22) !important;
        }
        .manual-pdf-button {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 10px 24px rgba(30,95,173,.24);
          transition: transform .15s ease, opacity .15s ease, box-shadow .15s ease;
        }
        .manual-pdf-button:hover {
          transform: translateY(-1px);
          opacity: 1 !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 14px 30px rgba(30,95,173,.30);
        }
        [data-theme="dark"] .manual-home {
          --manual-accent: #60A5FA;
          --manual-accent-soft: rgba(96,165,250,.15);
          --manual-accent-border: rgba(96,165,250,.28);
          --manual-gold: #FBBF24;
          --manual-shadow-sm: 0 10px 24px rgba(0,0,0,.22);
          --manual-shadow-md: 0 18px 40px rgba(0,0,0,.32);
          --primary: #60A5FA;
          --primary-soft: rgba(96,165,250,.15);
          background:
            radial-gradient(circle at 92% 4%, rgba(96,165,250,.18), transparent 30%),
            radial-gradient(circle at 5% 100%, rgba(251,191,36,.12), transparent 32%),
            linear-gradient(180deg, rgba(15,23,42,.96), rgba(30,41,59,.88));
          border-color: rgba(96,165,250,.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
        }
        [data-theme="dark"] .manual-home::before {
          background:
            linear-gradient(rgba(96,165,250,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(96,165,250,.045) 1px, transparent 1px);
        }
        [data-theme="dark"] .manual-home-kicker {
          background: rgba(15,23,42,.74);
          border-color: rgba(96,165,250,.26);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08), var(--manual-shadow-sm);
        }
        [data-theme="dark"] .manual-stat-card,
        [data-theme="dark"] .manual-info-card,
        [data-theme="dark"] .manual-team-card,
        [data-theme="dark"] .manual-section-link,
        [data-theme="dark"] .manual-pdf-card {
          box-shadow: var(--manual-shadow-sm), inset 0 1px 0 rgba(255,255,255,.07) !important;
        }
        [data-theme="dark"] .manual-stat-card {
          background: linear-gradient(135deg, rgba(30,41,59,.94), var(--stat-tone-soft, rgba(96,165,250,.13))) !important;
          border-color: rgba(148,163,184,.24) !important;
        }
        [data-theme="dark"] .manual-info-card {
          background: rgba(30,41,59,.88) !important;
          border-color: rgba(148,163,184,.24) !important;
        }
        [data-theme="dark"] .manual-team-card {
          background: linear-gradient(135deg, rgba(30,41,59,.90), rgba(15,23,42,.72)) !important;
          border-color: rgba(148,163,184,.22) !important;
        }
        [data-theme="dark"] .manual-info-card:hover,
        [data-theme="dark"] .manual-team-card:hover,
        [data-theme="dark"] .manual-stat-card:hover {
          box-shadow: var(--manual-shadow-md), inset 0 1px 0 rgba(255,255,255,.09) !important;
        }
        [data-theme="dark"] .manual-team-icon,
        [data-theme="dark"] .manual-section-icon {
          background: rgba(96,165,250,.12) !important;
          border-color: rgba(96,165,250,.24);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
        }
        [data-theme="dark"] .manual-section-link {
          background: linear-gradient(135deg, rgba(30,41,59,.95), rgba(15,23,42,.78)) !important;
          border-color: rgba(148,163,184,.22) !important;
        }
        [data-theme="dark"] .manual-section-link:hover,
        [data-theme="dark"] .manual-section-link:focus-visible {
          background: linear-gradient(135deg, rgba(96,165,250,.18), rgba(30,41,59,.96) 58%, rgba(251,191,36,.08)) !important;
          box-shadow: var(--manual-shadow-md), inset 0 1px 0 rgba(255,255,255,.10) !important;
        }
        [data-theme="dark"] .manual-section-index {
          color: rgba(148,163,184,.30) !important;
        }
        [data-theme="dark"] .manual-pdf-card {
          background: linear-gradient(135deg, rgba(96,165,250,.16), rgba(30,41,59,.88) 46%, rgba(15,23,42,.78)) !important;
          border-color: rgba(96,165,250,.28) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .manual-stat-card,
          .manual-info-card,
          .manual-team-card,
          .manual-section-link,
          .manual-pdf-button {
            transition: none !important;
          }
        }
      `}</style>
      <div className="manual-home">
      {/* ── Header ── */}
      <div className="manual-home-hero" style={{ marginBottom: 20 }}>
        <div className="manual-home-kicker" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--manual-accent)', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .95, marginBottom: 8 }}>01 · Overview</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em', lineHeight: 1.2 }}>
          {lang === 'th' ? 'ยินดีต้อนรับ' : 'Welcome'}
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8, maxWidth: 640 }}>
          {lang === 'th'
            ? 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ให้บริการตรวจวิเคราะห์ทางห้องปฏิบัติการสำหรับผู้ป่วยใน ผู้ป่วยนอก และผู้ป่วยฉุกเฉิน ตลอด 24 ชั่วโมง รวมถึงคลินิกนอกเวลาราชการ และการตรวจสุขภาพประจำปีแบบหมู่คณะ'
            : 'The Medical Technology Department, Chonburi Hospital provides laboratory testing for inpatients, outpatients, and emergency cases 24 hours a day, including after-hours clinics and group annual health checks.'}
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10, marginBottom: 22 }}>
        {[
          { label: lang === 'th' ? 'งานบริการ' : 'Service desks',         value: '10',   sub: lang === 'th' ? 'แผนก' : 'sections', icon: 'flask',    color: 'var(--manual-accent)', bg: 'var(--manual-accent-soft)', border: 'var(--manual-accent-border)' },
          { label: lang === 'th' ? 'ผู้ป่วยใน / ER' : 'Inpatient / ER', value: '24/7', sub: lang === 'th' ? 'ทุกวัน' : 'daily',  icon: 'clock',    color: '#0F766E', bg: 'rgba(15,118,110,.08)', border: 'rgba(15,118,110,.2)' },
          { label: lang === 'th' ? 'คลินิกนอกเวลา' : 'After-hours',     value: '16–24',sub: lang === 'th' ? 'น.' : 'hr.',          icon: 'building', color: '#B08D57', bg: 'rgba(176,141,87,.10)', border: 'rgba(176,141,87,.24)' },
        ].map((s) => (
          <div key={s.label} className="manual-stat-card" style={{ '--stat-tone-soft': s.bg, minWidth: 0, padding: '14px 16px', border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.color}`, borderRadius: 10, color: s.color } as CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={s.icon as any} size={14} style={{ color: '#fff' }} />
              </div>
              <span style={{ minWidth: 0, fontSize: 11, fontWeight: 700, color: s.color, letterSpacing: '.04em', textTransform: 'uppercase', opacity: .85, lineHeight: 1.35 }}>{s.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: s.color, letterSpacing: '-.03em', lineHeight: 1, overflowWrap: 'anywhere' }}>{s.value}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.color, opacity: .7 }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Address ── */}
      <div style={{ marginBottom: 22 }}>
        <div className="manual-section-title" style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          {lang === 'th' ? 'สถานที่ติดต่อ' : 'Office Address'}
        </div>
        <div className="manual-info-card" style={{ display: 'flex', gap: 12, padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(15,118,110,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="building" size={18} style={{ color: '#0F766E' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.75 }}>
            <div style={{ fontWeight: 700 }}>{lang === 'th' ? 'ชั้น 3 อาคารเฉลิมราชสมบัติ' : '3rd Floor, Chalerm Ratchasombat Building'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>
              {lang === 'th' ? '69 หมู่ 2 ถนนสุขุมวิท ต.บ้านสวน อ.เมือง จ.ชลบุรี 20000' : '69 Moo 2, Sukhumvit Rd., Ban Suan, Mueang, Chonburi 20000'}
            </div>
            <div style={{ marginTop: 5, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#0F766E', fontWeight: 600 }}>
                <Icon name="phone" size={11} /> 038-931455
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>
                <Icon name="mail" size={11} /> {lang === 'th' ? 'โทรสาร' : 'Fax'} 038-931455
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Team ── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <div className="manual-section-title" style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            {lang === 'th' ? 'หัวหน้างานและทีม' : 'Heads of Section'}
          </div>
          {team.canEdit && !editingTeam && (
            <button onClick={() => setEditingTeam(true)}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              แก้รายชื่อ
            </button>
          )}
        </div>
        {editingTeam ? (
          <ManualTableEditor schema={TABLE_SCHEMAS.team} rows={team.rows as unknown as EditableRow[]}
            onSaved={rows => { team.setRows(rows as unknown as TeamMember[]); setEditingTeam(false) }}
            onCancel={() => setEditingTeam(false)} />
        ) : (
        <div className="manual-team-grid">
          {team.rows.map((t, ti) => (
            <div
              key={ti}
              className="manual-team-card"
              style={{
                '--team-tone': TEAM_TONE.color,
                '--team-tone-soft': TEAM_TONE.bg,
                '--team-tone-border': TEAM_TONE.border,
                display: 'grid',
                gridTemplateColumns: '38px minmax(0, 1fr) minmax(52px, auto)',
                gap: 10,
                padding: '10px 12px',
                border: `1px solid ${TEAM_TONE.border}`,
                borderRadius: 9,
                alignItems: 'center',
                minWidth: 0,
              } as CSSProperties}
            >
              <div className="manual-team-icon" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="users" size={15} style={{ color: TEAM_TONE.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, lineHeight: 1.4 }}>{t.role}</div>
              </div>
              <div style={{ maxWidth: 92, fontSize: 12.5, fontWeight: 700, color: TEAM_TONE.color, fontFamily: '"IBM Plex Mono",monospace', textAlign: 'right', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{t.ext}</div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* ── Phone directory management (managers only; displayed in the sidebar) ── */}
      {phone.canEdit && (
        <div style={{ marginBottom: 22 }}>
          {editingPhone ? (
            <ManualTableEditor schema={TABLE_SCHEMAS.phoneDirectory} rows={phone.rows as unknown as EditableRow[]}
              onSaved={rows => { phone.setRows(rows as unknown as PhoneEntry[]); setEditingPhone(false) }}
              onCancel={() => setEditingPhone(false)} />
          ) : (
            <button onClick={() => setEditingPhone(true)}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              แก้เบอร์โทรภายใน
            </button>
          )}
        </div>
      )}

      {/* ── Section navigation ── */}
      <div style={{ marginBottom: 22 }}>
        <div className="manual-section-title" style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          {lang === 'th' ? 'หัวข้อในคู่มือ' : 'Contents'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {MANUAL_SECTIONS.slice(1).map((s, i) => {
            return (
            <button
              key={s.id}
              className="manual-section-link"
              onClick={() => goto(s.id)}
              style={{
                '--section-tone': SECTION_TONE.color,
                '--section-tone-soft': SECTION_TONE.bg,
                '--section-tone-border': SECTION_TONE.border,
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', gap: 8, padding: '11px 10px', minWidth: 0,
                border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
              } as CSSProperties}
            >
              {/* Faded section number watermark */}
              <span className="manual-section-index" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 34, fontWeight: 900, color: 'var(--border)', opacity: 1, lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '-.04em' }}>
                {String(i + 2).padStart(2, '0')}
              </span>

              {/* Icon */}
              <div className="manual-section-icon" style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={s.icon as any} size={15} style={{ color: SECTION_TONE.color }} />
              </div>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{lang === 'th' ? s.th : s.en}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{lang === 'th' ? s.en : s.th}</div>
              </div>

              <Icon name="arrowRight" size={13} style={{ color: SECTION_TONE.color, opacity: .72, flexShrink: 0, zIndex: 1 }} />
            </button>
            )
          })}
        </div>
      </div>

      {/* ── Fee note ── */}
      <Callout tone="info" icon="shieldCheck">
        {lang === 'th'
          ? <span><strong>อัตราค่าบริการ</strong> คิดตามเกณฑ์กระทรวงสาธารณสุข พ.ศ. 2549 ผู้ที่ใช้สิทธิบัตรต่างๆ ต้องผ่านการตรวจสอบสิทธิก่อนเก็บสิ่งตัวอย่าง</span>
          : <span><strong>Fees</strong> follow the Ministry of Public Health 2006 schedule. Insurance patients must complete eligibility verification before specimen collection.</span>}
      </Callout>

      {/* ── PDF download ── */}
      <div className="manual-pdf-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, padding: '14px 16px', background: 'var(--manual-accent-soft)', border: '1px solid var(--manual-accent-border)', borderRadius: 12, flexWrap: 'wrap' }}>
        <div className="manual-pdf-icon" style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--manual-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="doc" size={20} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--manual-accent)' }}>{lang === 'th' ? 'คู่มือฉบับเต็ม (PDF)' : 'Full Manual (PDF)'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>MN-LAB-01 · พ.ศ. 2569 · 116 หน้า · กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
        </div>
        <a
          href="/documents/MN-LAB-01.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="manual-pdf-button"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'var(--manual-accent)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0, transition: 'transform .15s ease, opacity .15s ease, box-shadow .15s ease' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.85' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
        >
          <Icon name="download" size={14} style={{ color: '#fff' }} />
          {lang === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF'}
        </a>
      </div>
      </div>
    </Section>
  )
}
