import { Callout, H3, StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { STOOL_STEPS_EN, STOOL_STEPS_TH } from '../collection-data'

interface Props { lang: Lang }

const NOTES = [
  { th: 'ห้ามเก็บอุจจาระจากโถส้วมโดยตรง', en: 'Do not collect stool directly from the toilet bowl.' },
  { th: 'หากมีมูกหรือเลือด ให้ตักรวมส่วนที่ผิดปกตินั้นลงในตัวอย่าง', en: 'If mucus or blood is present, include the abnormal portion in the sample.' },
  { th: 'ห้ามใช้กระดาษชำระเป็นภาชนะเก็บตัวอย่าง', en: 'Do not use tissue paper as the collection surface or container.' },
]

export function CollectionStool({ lang }: Props) {
  return (
    <div>
      <H3 mt={0}>{lang === 'th' ? 'วิธีการเก็บอุจจาระ' : 'Stool Collection Procedure'}</H3>
      <StepList steps={lang === 'th' ? STOOL_STEPS_TH : STOOL_STEPS_EN} />

      <Callout tone="info" icon="cup">
        {lang === 'th'
          ? 'สำหรับการเพาะเชื้ออุจจาระ ให้เก็บอุจจาระเหลวหรือส่วนที่มีมูก/เลือดตามวิธีของงานจุลชีววิทยา และใช้ Cary & Blair หรือ Amies transport medium ตามที่กำหนด'
          : 'For stool culture, collect liquid stool or the mucus/blood-containing portion according to the microbiology procedure, using Cary & Blair or Amies transport medium as specified.'}
      </Callout>

      <div style={{ marginTop: 16, border: '1px solid rgba(217,119,6,.28)', borderLeft: '3px solid #D97706', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: 'rgba(217,119,6,.08)', borderBottom: '1px solid rgba(217,119,6,.18)', color: '#B45309', fontSize: 12, fontWeight: 800 }}>
          {lang === 'th' ? 'ข้อควรระวัง' : 'Notes'}
        </div>
        <div style={{ padding: '6px 0', background: 'rgba(217,119,6,.04)' }}>
          {NOTES.map((note, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 16px 7px 14px', borderBottom: index < NOTES.length - 1 ? '1px solid rgba(217,119,6,.1)' : 'none' }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#D97706', flexShrink: 0, marginTop: 7 }} />
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{lang === 'th' ? note.th : note.en}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
