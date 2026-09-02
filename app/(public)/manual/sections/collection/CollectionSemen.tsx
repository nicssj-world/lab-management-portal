import { Callout, H3, StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { SEMEN_STEPS_EN, SEMEN_STEPS_TH } from '../collection-data'

interface Props { lang: Lang }

export function CollectionSemen({ lang }: Props) {
  return (
    <div>
      <Callout tone="info" icon="cell">
        {lang === 'th'
          ? 'การตรวจน้ำอสุจิต้องควบคุมระยะงดการหลั่ง ภาชนะ และเวลานำส่งให้ครบถ้วน เพื่อให้ผลตรวจสะท้อนตัวอย่างที่เก็บได้จริง'
          : 'Semen analysis depends on the abstinence interval, the collection container, and the delivery time being controlled and documented.'}
      </Callout>

      <H3 mt={0}>{lang === 'th' ? 'วิธีการเก็บน้ำอสุจิ' : 'Semen Collection Procedure'}</H3>
      <StepList steps={lang === 'th' ? SEMEN_STEPS_TH : SEMEN_STEPS_EN} />

      <Callout tone="warning" icon="clock">
        {lang === 'th'
          ? 'นำส่งห้องปฏิบัติการภายใน 1 ชั่วโมง ห้ามแช่เย็น และต้องระบุชื่อผู้ป่วย วันที่ และเวลาที่เก็บบนภาชนะ'
          : 'Deliver to the laboratory within 1 hour. Do not refrigerate. Label the container with patient name, collection date, and collection time.'}
      </Callout>
    </div>
  )
}
