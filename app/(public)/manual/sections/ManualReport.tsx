import { H2, H3, P, Callout, Section, Th, TblRow } from '../_primitives'
import { CRITICAL_VALUES, type Lang } from '../data'

interface Props { lang: Lang }

const ISBAR_STEPS = [
  { k: 'I — Identify',  th: 'ผู้รายงานระบุ ชื่อ-สกุล ตำแหน่ง หน่วยงาน · ปลายสายระบุชื่อ-สกุล (แพทย์) ผู้รับรายงาน', en: 'Reporter states name, role, section. Receiving physician states their name.' },
  { k: 'S — Situation', th: 'ผู้รายงานกล่าวสถานการณ์ที่พบ — ค่าวิกฤติของผู้ป่วย: ชื่อ-สกุล, HN., รายการทดสอบ, ค่าที่พบ',   en: 'Reporter announces: critical result for patient name, HN, test, value.' },
  { k: 'B — Background', th: 'หากแพทย์เจ้าของไข้ติดต่อไม่ได้ ให้ลำดับเป็น แพทย์ที่ 1 → ที่ 2 → ที่ 3 → หัวหน้ากลุ่มงานฯ (สิ้นสุดการแจ้ง)', en: 'If attending is unreachable: escalate to MD #1, MD #2, MD #3, then department head (terminates chain).' },
  { k: 'A — Assessment / R — Recommendation', th: 'แพทย์ผู้รับ Write down ใน Doctor order sheet / OPD record และ Read back เพื่อยืนยัน', en: 'Receiving MD writes down on the Doctor Order Sheet / OPD record and reads back to confirm.' },
  { k: 'R — Record', th: 'ผู้รายงาน confirm ข้อมูลตรงกับที่รายงาน และบันทึกชื่อแพทย์ผู้รับรายงานในระบบ CFS', en: "Reporter confirms accuracy and records the receiving MD's name in the CFS." },
]

export function ManualReport({ lang }: Props) {
  return (
    <Section>
      <H2 eyebrow="05 · Reporting">
        {lang === 'th' ? 'การรายงานผลการตรวจวิเคราะห์ และค่าวิกฤติ' : 'Result Reporting & Critical Values'}
      </H2>
      <P>
        {lang === 'th'
          ? 'รายงานผลผ่านระบบสารสนเทศ LIS / HIS หรือพิมพ์ใบรายงานผลจาก HIS ให้ผู้รับบริการที่ร้องขอ — กลุ่มงานเทคนิคการแพทย์ไม่รายงานผลทางโทรศัพท์ในทุกกรณี ยกเว้นการรายงานค่าวิกฤติตามขั้นตอนด้านล่าง'
          : 'Results are reported via LIS / HIS or printed from HIS on request. The lab does NOT report results by phone — except critical values via the protocol below.'}
      </P>

      <Callout tone="danger" icon="alert">
        {lang === 'th'
          ? <span>การรายงานค่าวิกฤติต้องดำเนินการภายใน <strong>15 นาที</strong> นับจากเวลาที่ Approve ผลในระบบ LIS</span>
          : <span>Critical-value notification must be completed within <strong>15 minutes</strong> of LIS approval.</span>}
      </Callout>

      <H3>{lang === 'th' ? 'ขั้นตอนการแจ้งค่าวิกฤติ (ISBAR · HP-IPSG2-CBH-007)' : 'Critical-value notification (ISBAR · HP-IPSG2-CBH-007)'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ISBAR_STEPS.map((step, i) => (
          <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{step.k}</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4, lineHeight: 1.55 }}>{lang === 'th' ? step.th : step.en}</div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'รายการค่าวิกฤติ (Critical Value)' : 'Critical-value list'}</H3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <Th>{lang === 'th' ? 'รายการ' : 'Analyte'}</Th>
              <Th>{lang === 'th' ? 'ผู้ใหญ่ (> 15 ปี)' : 'Adult (> 15 yr)'}</Th>
              <Th>{lang === 'th' ? 'เด็ก (0–15 ปี)' : 'Pediatric (0–15 yr)'}</Th>
              <Th>{lang === 'th' ? 'หน่วย' : 'Unit'}</Th>
            </tr>
          </thead>
          <tbody>
            {CRITICAL_VALUES.map((v) => (
              <TblRow key={v.test}>
                <td style={{ padding: '10px 12px', color: 'var(--ink)', fontWeight: 600 }}>{v.test}</td>
                <td style={{ padding: '10px 12px', color: v.adult === '—' ? 'var(--muted)' : '#B91C1C', fontWeight: v.adult === '—' ? 400 : 700, fontFamily: '"IBM Plex Mono",monospace' }}>{v.adult}</td>
                <td style={{ padding: '10px 12px', color: v.child === '—' ? 'var(--muted)' : '#B91C1C', fontWeight: v.child === '—' ? 400 : 700, fontFamily: '"IBM Plex Mono",monospace' }}>{v.child}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{v.unit}</td>
              </TblRow>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.55 }}>
        {lang === 'th'
          ? 'ทบทวนโดยองค์กรแพทย์และคณะอนุกรรมการมาตรฐาน IPSG 2 เมื่อวันที่ 2 พ.ย. 2565 — (—) หมายถึง ไม่มีค่าวิกฤติ'
          : 'Reviewed by Medical Staff Council and IPSG-2 sub-committee on 2 Nov 2022. (—) = no critical threshold.'}
      </div>

      <Callout tone="info" icon="phone">
        {lang === 'th'
          ? <span>หากไม่สามารถติดต่อแพทย์เจ้าของไข้ ให้โทรประสาน <strong>งานประชาสัมพันธ์ กด 0</strong> เพื่อขอเบอร์โทรติดต่อแพทย์โดยตรง</span>
          : <span>If the attending physician is unreachable, dial <strong>0 (Public Relations)</strong> to obtain a direct line.</span>}
      </Callout>
    </Section>
  )
}
