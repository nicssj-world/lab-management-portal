import { Callout } from '../../_primitives'
import { type Lang } from '../../data'
import { MICRO_PRINCIPLES_TH, MICRO_PRINCIPLES_EN, MICRO_TRANSPORTS, MICRO_URINE_PATHS, MICRO_SPUTUM } from '../collection-data'

interface Props { lang: Lang }

export function CollectionMicro({ lang }: Props) {
  const principles = lang === 'th' ? MICRO_PRINCIPLES_TH : MICRO_PRINCIPLES_EN

  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'หลักการทั่วไป' : 'General Principles'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}>
        {principles.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: i % 2 === 0 ? 'var(--card)' : 'var(--bg)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 7 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary-soft)', border: '1.5px solid rgba(30,95,173,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{p}</span>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ภาชนะและ Transport Media' : 'Containers & Transport Media'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {MICRO_TRANSPORTS.map((t) => (
          <div key={t.name} style={{ padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>{t.name}</strong>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{lang === 'th' ? t.useTh : t.useEn}</div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'การเก็บปัสสาวะเพื่อเพาะเชื้อ (3 รูปแบบ)' : 'Urine for Culture — 3 Methods'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 8 }}>
        {MICRO_URINE_PATHS.map((u, i) => (
          <div key={u.kind} style={{ display: 'flex', gap: 10, padding: '11px 13px', border: `1px solid ${u.color}25`, borderLeft: `3px solid ${u.color}`, borderRadius: 9, background: u.bg }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: u.color, letterSpacing: '.03em', marginBottom: 3 }}>{u.kind}</div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{lang === 'th' ? u.bodyTh : u.bodyEn}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <Callout tone="warning" icon="alert">
          {lang === 'th'
            ? <span>ต้องมีผล Urinalysis บ่งชี้: <strong>WBC ≥ 5–10/HPF</strong> หรือ <strong>Leukocyte esterase ≥ 1+</strong> · ยกเว้นผู้ป่วย Low immune / Febrile neutropenia / ทารก &lt; 6 เดือน / ปลูกถ่ายไต / ระบบทางเดินปัสสาวะ / แพทย์ระบุเหตุผล + เลขใบประกอบฯ</span>
            : <span>Requires Urinalysis evidence: <strong>WBC ≥ 5–10/HPF</strong> OR <strong>Leukocyte esterase ≥ 1+</strong>. Exceptions: low-immune / febrile neutropenia, infant &lt; 6 mo, kidney transplant, urology, physician-specified reason with license number.</span>}
        </Callout>
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'การเก็บเสมหะ (3 วิธี)' : 'Sputum Collection — 3 Methods'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        {MICRO_SPUTUM.map((m, i) => (
          <div key={m.k} style={{ padding: '11px 13px', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--primary)', letterSpacing: '.04em' }}>{m.k}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>{lang === 'th' ? m.th : m.en}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <Callout tone="warning" icon="alert">
          {lang === 'th'
            ? <span>คุณภาพเสมหะ: ต้องมี <strong>WBC &gt; 25 cells/LPF</strong> และ <strong>Squamous Epithelial cell &lt; 10 cells/LPF</strong> · ผู้ป่วย low immune / ทารก &lt; 6 ด. ใช้เกณฑ์ SEC อย่างเดียว</span>
            : <span>Sputum quality: <strong>WBC &gt; 25/LPF</strong> AND <strong>SEC &lt; 10/LPF</strong>. For low-immune / infants &lt; 6 mo, only SEC criterion applies.</span>}
        </Callout>
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'CSF · Body Fluid' : 'CSF · Body Fluid'}
      </h3>
      <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, color: 'var(--ink)', lineHeight: 1.8 }}>
        {lang === 'th'
          ? 'CSF เก็บโดย Lumbar puncture ระหว่าง L3–L4 — แบ่งเป็น 3 ส่วน ส่วนละ 1–3 mL ส่วนแรกใช้สำหรับเพาะเชื้อ (แบคทีเรีย วัณโรค เชื้อรา) · ปิดด้วย parafilm · ห้ามแช่เย็น · Sterile body fluid อื่นๆ ใช้ aseptic technique ลงในภาชนะปราศจากเชื้อ ปิด parafilm นำส่งทันที'
          : 'CSF: lumbar puncture at L3–L4 split into 3 tubes (1–3 mL each); first tube for culture (bacteria, mycobacteria, fungi). Seal with parafilm. NEVER refrigerate. Other sterile body fluids: aseptic collection into sterile container, parafilm-sealed, delivered immediately.'}
      </div>
    </div>
  )
}
