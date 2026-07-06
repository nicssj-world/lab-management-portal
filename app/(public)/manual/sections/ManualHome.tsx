import { Icon } from '@/components/ui/Icon'
import { Callout, Section } from '../_primitives'
import { MANUAL_SECTIONS, TEAM, type Lang } from '../data'

interface Props {
  lang: Lang
  goto: (id: string) => void
}


const AVATAR_COLORS = [
  { ring: '#1E5FAD', grad: 'radial-gradient(circle at 38% 32%, #3B82C4, #1A52A0)' },
  { ring: '#0891B2', grad: 'radial-gradient(circle at 38% 32%, #22B8DA, #066E8A)' },
  { ring: '#7C3AED', grad: 'radial-gradient(circle at 38% 32%, #9D62F0, #5B21B6)' },
  { ring: '#C2620A', grad: 'radial-gradient(circle at 38% 32%, #F0A040, #B45309)' },
  { ring: '#065F46', grad: 'radial-gradient(circle at 38% 32%, #0B9E76, #044332)' },
  { ring: '#9D174D', grad: 'radial-gradient(circle at 38% 32%, #C2346E, #7B0D37)' },
  { ring: '#1E40AF', grad: 'radial-gradient(circle at 38% 32%, #4A72D8, #1634A0)' },
]

export function ManualHome({ lang, goto }: Props) {
  return (
    <Section>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .8, marginBottom: 6 }}>01 · Overview</div>
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
          { label: lang === 'th' ? 'งานบริการ' : 'Service desks',         value: '10',   sub: lang === 'th' ? 'แผนก' : 'sections', icon: 'flask',    color: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.18)' },
          { label: lang === 'th' ? 'ผู้ป่วยใน / ER' : 'Inpatient / ER', value: '24/7', sub: lang === 'th' ? 'ทุกวัน' : 'daily',  icon: 'clock',    color: '#0891B2', bg: 'rgba(8,145,178,.08)', border: 'rgba(8,145,178,.2)' },
          { label: lang === 'th' ? 'คลินิกนอกเวลา' : 'After-hours',     value: '16–24',sub: lang === 'th' ? 'น.' : 'hr.',          icon: 'building', color: '#7C3AED', bg: 'rgba(124,58,237,.07)', border: 'rgba(124,58,237,.18)' },
        ].map((s) => (
          <div key={s.label} style={{ minWidth: 0, padding: '14px 16px', border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.color}`, borderRadius: 10, background: s.bg }}>
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
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          {lang === 'th' ? 'สถานที่ติดต่อ' : 'Office Address'}
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="building" size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.75 }}>
            <div style={{ fontWeight: 700 }}>{lang === 'th' ? 'ชั้น 3 อาคารเฉลิมราชสมบัติ' : '3rd Floor, Chalerm Ratchasombat Building'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>
              {lang === 'th' ? '69 หมู่ 2 ถนนสุขุมวิท ต.บ้านสวน อ.เมือง จ.ชลบุรี 20000' : '69 Moo 2, Sukhumvit Rd., Ban Suan, Mueang, Chonburi 20000'}
            </div>
            <div style={{ marginTop: 5, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--primary)', fontWeight: 600 }}>
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
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          {lang === 'th' ? 'หัวหน้างานและทีม' : 'Heads of Section'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 8 }}>
          {TEAM.map((t, i) => {
            const av = AVATAR_COLORS[i % AVATAR_COLORS.length]
            return (
              <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr) minmax(52px, auto)', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)', alignItems: 'center', minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: av.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 0 2px var(--card), 0 0 0 3.5px ${av.ring}` }}>
                  <Icon name="users" size={16} style={{ color: 'rgba(255,255,255,.9)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, lineHeight: 1.4 }}>{t.role}</div>
                </div>
                <div style={{ maxWidth: 92, fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', fontFamily: '"IBM Plex Mono",monospace', textAlign: 'right', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{t.ext}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section navigation ── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          {lang === 'th' ? 'หัวข้อในคู่มือ' : 'Contents'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {MANUAL_SECTIONS.slice(1).map((s, i) => (
            <button
              key={s.id}
              onClick={() => goto(s.id)}
              style={{
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', gap: 8, padding: '11px 10px', minWidth: 0,
                border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
              }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--primary)'; el.style.background = 'var(--primary-soft)'; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 4px 12px rgba(30,95,173,.12)' }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--card)'; el.style.transform = 'none'; el.style.boxShadow = 'none' }}
            >
              {/* Faded section number watermark */}
              <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 34, fontWeight: 900, color: 'var(--border)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '-.04em' }}>
                {String(i + 2).padStart(2, '0')}
              </span>

              {/* Icon */}
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={s.icon as any} size={15} style={{ color: '#fff' }} />
              </div>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{lang === 'th' ? s.th : s.en}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{lang === 'th' ? s.en : s.th}</div>
              </div>

              <Icon name="arrowRight" size={13} style={{ color: 'var(--muted)', flexShrink: 0, zIndex: 1 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Fee note ── */}
      <Callout tone="info" icon="shieldCheck">
        {lang === 'th'
          ? <span><strong>อัตราค่าบริการ</strong> คิดตามเกณฑ์กระทรวงสาธารณสุข พ.ศ. 2549 ผู้ที่ใช้สิทธิบัตรต่างๆ ต้องผ่านการตรวจสอบสิทธิก่อนเก็บสิ่งตัวอย่าง</span>
          : <span><strong>Fees</strong> follow the Ministry of Public Health 2006 schedule. Insurance patients must complete eligibility verification before specimen collection.</span>}
      </Callout>

      {/* ── PDF download ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, padding: '14px 16px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.22)', borderRadius: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="doc" size={20} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? 'คู่มือฉบับเต็ม (PDF)' : 'Full Manual (PDF)'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>MN-LAB-01 · พ.ศ. 2569 · 116 หน้า · กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
        </div>
        <a
          href="/documents/MN-LAB-01.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0, transition: 'opacity .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.85' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
        >
          <Icon name="download" size={14} style={{ color: '#fff' }} />
          {lang === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF'}
        </a>
      </div>
    </Section>
  )
}
