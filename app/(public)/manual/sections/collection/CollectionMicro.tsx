import { Callout, H3 } from '../../_primitives'
import { Icon } from '@/components/ui/Icon'
import { type Lang } from '../../data'
import { DetailRows } from './CollectionMedia'
import {
  MICRO_COLLECTION_DETAILS,
  MICRO_PRINCIPLES_EN,
  MICRO_PRINCIPLES_TH,
  MICRO_SPUTUM,
  MICRO_TRANSPORTS,
  MICRO_URINE_PATHS,
} from '../collection-data'

interface Props { lang: Lang }

export function CollectionMicro({ lang }: Props) {
  const principles = lang === 'th' ? MICRO_PRINCIPLES_TH : MICRO_PRINCIPLES_EN

  return (
    <div>
      <Callout tone="info" icon="microscope">
        {lang === 'th'
          ? 'รายละเอียดในแท็บนี้เป็นวิธีการเก็บสิ่งส่งตรวจเพื่อเพาะเชื้อและการตรวจทางจุลชีววิทยา ส่วนเกณฑ์รับ–ปฏิเสธ เกณฑ์คุณภาพ และเงื่อนไขการทำซ้ำ ให้ตรวจสอบในหัวข้อ “การส่งตัวอย่างส่งตรวจ”'
          : 'This tab covers collection procedures for culture and microbiology testing. Acceptance, rejection, quality, and repeat-testing criteria are in “Specimen Transport”.'}
      </Callout>

      <H3 mt={0}>{lang === 'th' ? 'หลักการทั่วไป' : 'General Principles'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}>
        {principles.map((principle, index) => (
          <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: index % 2 === 0 ? 'var(--card)' : 'var(--bg)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 7 }}>
            <div aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary-soft)', border: '1.5px solid rgba(30,95,173,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>{index + 1}</div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{principle}</span>
          </div>
        ))}
      </div>

      <H3 mt={0}>{lang === 'th' ? 'ภาชนะและ Transport Media' : 'Containers and Transport Media'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 8, marginBottom: 20 }}>
        {MICRO_TRANSPORTS.map(transport => (
          <article key={transport.name} style={{ padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <Icon name={transport.icon} size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>{transport.name}</strong>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{lang === 'th' ? transport.useTh : transport.useEn}</div>
          </article>
        ))}
      </div>

      <H3 mt={0}>{lang === 'th' ? 'การเก็บปัสสาวะเพื่อเพาะเชื้อ (3 รูปแบบ)' : 'Urine for Culture — 3 Methods'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
        {MICRO_URINE_PATHS.map((urine, index) => (
          <article key={urine.kind} style={{ display: 'flex', gap: 10, padding: '11px 13px', border: `1px solid ${urine.color}25`, borderLeft: `3px solid ${urine.color}`, borderRadius: 9, background: urine.bg }}>
            <div aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', background: urine.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, marginTop: 1 }}>{index + 1}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: urine.color, letterSpacing: '.03em', marginBottom: 3 }}>{urine.kind}</div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{lang === 'th' ? urine.bodyTh : urine.bodyEn}</div>
            </div>
          </article>
        ))}
      </div>

      <H3 mt={0}>{lang === 'th' ? 'การเก็บเสมหะ (3 วิธี)' : 'Sputum Collection — 3 Methods'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 8, marginBottom: 20 }}>
        {MICRO_SPUTUM.map((sputum, index) => (
          <article key={sputum.k} style={{ padding: '11px 13px', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{index + 1}</div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--primary)', letterSpacing: '.04em' }}>{sputum.k}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>{lang === 'th' ? sputum.th : sputum.en}</div>
          </article>
        ))}
      </div>

      <H3 mt={0}>{lang === 'th' ? 'รายละเอียดวิธีเก็บสิ่งส่งตรวจอื่น ๆ' : 'Additional Collection Procedures'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        {MICRO_COLLECTION_DETAILS.map(section => (
          <section key={section.id} aria-labelledby={`micro-collection-${section.id}`}>
            <h4 id={`micro-collection-${section.id}`} style={{ margin: '0 0 8px', padding: '8px 12px', borderRadius: '8px 8px 0 0', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.18)', borderBottom: 0, color: 'var(--primary)', fontSize: 13, fontWeight: 800 }}>
              {lang === 'th' ? section.titleTh : section.titleEn}
            </h4>
            <DetailRows items={section.items} lang={lang} />
          </section>
        ))}
      </div>

    </div>
  )
}
