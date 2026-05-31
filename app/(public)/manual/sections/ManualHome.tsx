import { Icon } from '@/components/ui/Icon'
import { H2, H3, P, Callout, Section, Th, TblRow } from '../_primitives'
import { MANUAL_SECTIONS, TEAM, type Lang } from '../data'

interface Props {
  lang: Lang
  goto: (id: string) => void
}

export function ManualHome({ lang, goto }: Props) {
  return (
    <Section>
      <H2 eyebrow="01 · Overview">{lang === 'th' ? 'หน้าแรก' : 'Home'}</H2>
      <P>
        {lang === 'th'
          ? 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี มีบทบาทหน้าที่ในการให้บริการตรวจวิเคราะห์ทางห้องปฏิบัติการสำหรับผู้ป่วยใน ผู้ป่วยนอก และผู้ป่วยฉุกเฉิน ตลอด 24 ชั่วโมง รวมถึงคลินิกนอกเวลาราชการ และการตรวจสุขภาพประจำปีแบบหมู่คณะ'
          : 'The Medical Technology Department, Chonburi Hospital provides laboratory testing for inpatients, outpatients, and emergency cases 24 hours a day, including after-hours clinics and group annual health checks.'}
      </P>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '14px 0 6px' }}>
        {[
          { label: lang === 'th' ? 'งานบริการ' : 'Service desks',           value: '10',     icon: 'flask',   sub: lang === 'th' ? 'แผนก' : 'sections' },
          { label: lang === 'th' ? 'ผู้ป่วยใน / ER' : 'Inpatient / ER',     value: '24/7',  icon: 'clock',   sub: lang === 'th' ? 'ทุกวัน' : 'daily' },
          { label: lang === 'th' ? 'คลินิกนอกเวลา' : 'After-hours clinic',  value: '16–24', icon: 'building',sub: lang === 'th' ? 'น.' : 'hr.' },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={s.icon} size={18} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.01em' }}>
                {s.value} <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>{s.sub}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'สถานที่ติดต่อราชการ' : 'Office address'}</H3>
      <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
        <div>{lang === 'th' ? 'ชั้น 3 อาคารเฉลิมราชสมบัติ' : '3rd floor, Chalerm Ratchasombat Building'}</div>
        <div style={{ color: 'var(--muted)' }}>
          {lang === 'th' ? '69 หมู่ 2 ถนนสุขุมวิท ต.บ้านสวน อ.เมือง จ.ชลบุรี 20000' : '69 Moo 2, Sukhumvit Rd., Ban Suan, Mueang, Chonburi 20000'}
        </div>
        <div style={{ marginTop: 4 }}>
          <Icon name="phone" size={12} style={{ verticalAlign: -1, color: 'var(--primary)' }} /> 038-931455 &nbsp;·&nbsp;
          <Icon name="mail" size={12} style={{ verticalAlign: -1, color: 'var(--primary)' }} /> {lang === 'th' ? 'โทรสาร' : 'Fax'} 038-931455
        </div>
      </div>

      <H3>{lang === 'th' ? 'หัวหน้างานและทีม' : 'Heads of section'}</H3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <Th>{lang === 'th' ? 'ชื่อ–สกุล' : 'Name'}</Th>
              <Th>{lang === 'th' ? 'หน้าที่' : 'Role'}</Th>
              <Th>{lang === 'th' ? 'ภายใน' : 'Ext.'}</Th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map((t) => (
              <TblRow key={t.name}>
                <td style={{ padding: '10px 12px', color: 'var(--ink)', fontWeight: 600 }}>{t.name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{t.role}</td>
                <td style={{ padding: '10px 12px', color: 'var(--primary)', fontFamily: '"IBM Plex Mono",monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.ext}</td>
              </TblRow>
            ))}
          </tbody>
        </table>
      </div>

      <H3>{lang === 'th' ? 'หัวข้อในคู่มือ' : 'Contents'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {MANUAL_SECTIONS.slice(1).map((s, i) => (
          <button
            key={s.id}
            onClick={() => goto(s.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14,
              border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)' }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700 }}>
              0{i + 2}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{lang === 'th' ? s.th : s.en}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{lang === 'th' ? s.en : s.th}</div>
            </div>
            <Icon name="arrowRight" size={14} style={{ color: 'var(--muted)', alignSelf: 'center', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      <Callout tone="info" icon="shieldCheck">
        {lang === 'th'
          ? <span><strong>อัตราค่าบริการ</strong> คิดตามเกณฑ์กระทรวงสาธารณสุข พ.ศ. 2549 ผู้ที่ใช้สิทธิบัตรต่างๆ ต้องผ่านการตรวจสอบสิทธิก่อนเก็บสิ่งตัวอย่าง</span>
          : <span><strong>Fees</strong> follow the Ministry of Public Health 2006 schedule. Insurance patients must complete eligibility verification before specimen collection.</span>}
      </Callout>

      {/* PDF download banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.25)', borderRadius: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="doc" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? 'คู่มือฉบับเต็ม (PDF)' : 'Full manual (PDF)'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>MN-LAB-01 · พ.ศ. 2569 · 116 หน้า · กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
        </div>
        <a
          href="/documents/MN-LAB-01.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
        >
          <Icon name="download" size={15} />
          {lang === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF'}
        </a>
      </div>
    </Section>
  )
}
