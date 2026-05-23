import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { H2, H3, P, Callout, Section, Th, TblRow } from '../_primitives'
import { OUTLAB_PARTNERS, OUTLAB_TESTS, type Lang } from '../data'

interface Props { lang: Lang }

const FLOW_STEPS = [
  { th: 'แพทย์ Order ในระบบ HIS',             en: 'Physician orders in HIS' },
  { th: 'เก็บตัวอย่าง · ส่งห้อง OUT LAB',      en: 'Collect · deliver to OUT LAB' },
  { th: 'ตรวจสอบ · เตรียมส่ง',                  en: 'QC · prepare shipment' },
  { th: 'ส่งหน่วยงานคู่สัญญา',                  en: 'Ship to reference lab' },
  { th: 'รับรายงานผล · บันทึก LIS/HIS',         en: 'Receive · log to LIS/HIS' },
  { th: 'แพทย์รับผ่าน HIS',                    en: 'Physician views via HIS' },
]

export function ManualOutLab({ lang }: Props) {
  const govt = OUTLAB_PARTNERS.filter((p) => p.sector === 'gov')
  const priv = OUTLAB_PARTNERS.filter((p) => p.sector === 'priv')

  return (
    <Section>
      <H2 eyebrow="06 · Send-out">
        {lang === 'th' ? 'การใช้บริการ OUT LAB' : 'OUT LAB Service'}
      </H2>
      <P>
        {lang === 'th'
          ? 'รายการตรวจที่ยังไม่เปิดให้บริการในโรงพยาบาลจะถูกส่งต่อไปยังห้องปฏิบัติการคู่สัญญาที่ได้รับการรับรองมาตรฐาน โดยห้อง OUT LAB (โทร. 1461) เป็นผู้รับผิดชอบการบรรจุ ขนส่ง ติดตามผล และคืนรายงานผ่าน HIS'
          : 'Tests not performed in-house are forwarded to accredited reference laboratories. The OUT LAB section (ext. 1461) handles packaging, shipment, follow-up, and returning the result via HIS.'}
      </P>

      <H3>{lang === 'th' ? 'หน่วยงานที่ส่งตรวจต่อ — ภาครัฐ' : 'Reference labs — government'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {govt.map((o) => (
          <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="building" size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{o.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{o.brand} · {o.accred}</div>
            </div>
            <Badge color="blue" size="sm">ภาครัฐ</Badge>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'ภาคเอกชน' : 'Reference labs — private sector'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {priv.map((o) => (
          <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(22,163,74,.10)', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="building" size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{o.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{o.brand} · {o.accred}</div>
            </div>
            <Badge color="green" size="sm">เอกชน</Badge>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'Flow การส่งตรวจ OUT LAB' : 'OUT LAB workflow'}</H3>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, overflowX: 'auto', padding: 4 }}>
        {FLOW_STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ flex: 1, minWidth: 120, padding: '12px 10px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{i + 1}</div>
              <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 4, lineHeight: 1.4 }}>{lang === 'th' ? s.th : s.en}</div>
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <Icon name="chevRight" size={16} style={{ color: 'var(--muted)', alignSelf: 'center', flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <H3>{lang === 'th' ? 'รายการส่งตรวจ OUT LAB (ตัวอย่าง)' : 'OUT LAB tests — sample listing'}</H3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 460, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
              <Th>{lang === 'th' ? 'รหัส' : 'Code'}</Th>
              <Th>{lang === 'th' ? 'รายการ' : 'Test'}</Th>
              <Th>{lang === 'th' ? 'วิธี' : 'Method'}</Th>
              <Th>{lang === 'th' ? 'ตัวอย่าง' : 'Sample'}</Th>
              <Th>TAT</Th>
              <Th align="right">฿</Th>
            </tr>
          </thead>
          <tbody>
            {OUTLAB_TESTS.map((t) => (
              <TblRow key={t.code}>
                <td style={{ padding: '10px 12px', color: 'var(--primary)', fontFamily: '"IBM Plex Mono",monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.code}</td>
                <td style={{ padding: '10px 12px', color: 'var(--ink)', fontWeight: 600 }}>{t.name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{t.method}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{t.sample}</td>
                <td style={{ padding: '10px 12px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{t.tat}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ink)', fontWeight: 600, fontFamily: '"IBM Plex Mono",monospace' }}>{t.price.toLocaleString()}</td>
              </TblRow>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.55 }}>
        {lang === 'th'
          ? 'รายการเต็มในระบบ HIS — รวมประมาณ 600+ รายการ ราคาตามอัตรากระทรวงสาธารณสุข พ.ศ. 2549'
          : 'Full list (~600 tests) in HIS. Prices follow the Ministry of Public Health 2006 schedule.'}
      </div>

      <Callout tone="info" icon="mail">
        {lang === 'th'
          ? 'การส่ง OUT LAB ทุกครั้ง ห้องปฏิบัติการจะติดตามผลและบันทึกเข้าระบบ HIS ของโรงพยาบาลอัตโนมัติ — แพทย์ไม่ต้องโทรติดตามด้วยตนเอง'
          : 'For every OUT LAB send-out, the lab tracks the result and auto-attaches it to HIS — no manual follow-up needed.'}
      </Callout>
    </Section>
  )
}
