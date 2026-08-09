'use client'

import { LabMapShell } from './LabMapShell'
import type { LabMapDTO, LabSafetyEquipmentDefinition } from '@/lib/lab-map/types'

const KIND_LABELS: Record<LabSafetyEquipmentDefinition['kind'], string> = {
  'fire-extinguisher': 'ถังดับเพลิง',
  'fire-hose': 'สายฉีดน้ำดับเพลิง',
  'manual-call-point': 'จุดกดแจ้งเหตุ',
  aed: 'เครื่อง AED',
  'first-aid-kit': 'ชุดปฐมพยาบาล',
  eyewash: 'ที่ล้างตา',
  'nss-eyewash': 'น้ำยาล้างตา NSS',
  'emergency-shower': 'ฝักบัวฉุกเฉิน',
  'spill-kit': 'ชุดจัดการสารหกรั่วไหล',
  'emergency-shutoff': 'จุดตัดระบบฉุกเฉิน',
}

const STATUS_LABELS: Record<NonNullable<LabSafetyEquipmentDefinition['operationalStatus']>, string> = {
  unverified: 'รอยืนยันตำแหน่ง', verified: 'ยืนยันตำแหน่งแล้ว', passed: 'พร้อมใช้',
  needs_attention: 'ต้องติดตาม', failed: 'ไม่พร้อมใช้', overdue: 'เกินกำหนดตรวจ', due_soon: 'ใกล้ครบกำหนดตรวจ',
}

export function SafetyEquipmentMap({ map }: { map: LabMapDTO }) {
  const equipment = map.safetyEquipment.filter((item) => item.kind !== 'fire-extinguisher')
  return (
    <LabMapShell
      map={map}
      allowedModes={['safety-assets']}
      initialMode="safety-assets"
      heading="แผนที่อุปกรณ์ความปลอดภัย"
      description="แสดงตำแหน่งอุปกรณ์ความปลอดภัยที่เผยแพร่แล้ว โดยแยกจากแผนผังทางหนีไฟ"
      eyebrow="SAFETY EQUIPMENT · ชั้น 3"
      searchItems={equipment.map((item) => ({ code: item.code, label: item.nameTh, type: KIND_LABELS[item.kind], keywords: `${item.code} ${item.sourceNoteTh ?? ''}` }))}
      renderDetail={(selectedCode) => {
        const item = equipment.find((candidate) => candidate.code === selectedCode)
        if (!item) return <div className="lab-map-empty-detail"><span aria-hidden="true">⌖</span><h2>เลือกอุปกรณ์เพื่อดูรายละเอียด</h2><p>แตะสัญลักษณ์บนผัง หรือค้นหาชื่ออุปกรณ์จากช่องค้นหา</p></div>
        return <div className="lab-map-safety-panel">
          <p className="lab-map-detail-type">{KIND_LABELS[item.kind]}</p>
          <h2>{item.nameTh}</h2>
          <div className="lab-map-detail-block"><span>รหัสอุปกรณ์</span><p>{item.code}</p></div>
          <div className="lab-map-detail-block"><span>สถานะ</span><p>{STATUS_LABELS[item.operationalStatus ?? (item.verified ? 'verified' : 'unverified')]}</p></div>
          {item.sourceNoteTh ? <div className="lab-map-detail-block"><span>จุดสังเกต</span><p>{item.sourceNoteTh}</p></div> : null}
          {item.kind === 'emergency-shutoff' && item.shutoffFor ? <div className="lab-map-detail-block"><span>ตัดระบบ</span><p>{item.shutoffFor === 'electricity' ? 'ไฟฟ้า' : 'ก๊าซ'}</p></div> : null}
        </div>
      }}
    />
  )
}
