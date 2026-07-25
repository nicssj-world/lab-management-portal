'use client'

import { LabMapShell } from './LabMapShell'
import type { LabMapDTO } from '@/lib/lab-map/types'

export interface StaffLabMapProps {
  map: LabMapDTO
}

export function StaffLabMap({ map }: StaffLabMapProps) {
  return (
    <LabMapShell
      map={map}
      allowedModes={['overview', 'infection', 'safety']}
      initialMode="overview"
      heading="แผนที่ห้องปฏิบัติการ ชั้น 3"
      description="ค้นหาห้องและหน่วยงาน ตรวจเขตควบคุมการติดเชื้อ หรือเลือกดูจุดความปลอดภัยบนแผนผังเดียวกัน"
      eyebrow="STAFF MAP · กลุ่มงานเทคนิคการแพทย์"
    />
  )
}
