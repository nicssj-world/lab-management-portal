'use client'

import type { ReactNode } from 'react'
import { LabMapShell } from './LabMapShell'
import type { MapMode, StaffLabMapDTO } from '@/lib/lab-map/types'

/** แผนที่หลักมีเฉพาะผังพื้นที่/เส้นทาง ไม่รวมทะเบียนอุปกรณ์ความปลอดภัย */
const STAFF_MAP_MODES: readonly MapMode[] = ['overview', 'infection', 'safety']

export function LabMapStaffClient({ map, headerActions }: { map: StaffLabMapDTO; headerActions?: ReactNode }) {
  return (
    <LabMapShell
      map={map}
      allowedModes={STAFF_MAP_MODES}
      initialMode="overview"
      heading="แผนที่ห้องปฏิบัติการ ชั้น 3"
      description="ค้นหาห้อง โซน หรือหน่วยงาน และดูแผนผังทางหนีไฟกับจุดรวมพลที่เผยแพร่"
      eyebrow="STAFF MAP · กลุ่มงานเทคนิคการแพทย์"
      headerActions={headerActions}
      showSafetyEquipment={false}
    />
  )
}
