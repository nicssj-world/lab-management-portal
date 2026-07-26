'use client'

import type { ReactNode } from 'react'
import { LabMapShell } from './LabMapShell'
import type { MapMode, StaffLabMapDTO } from '@/lib/lab-map/types'

/** โหมดที่เหลืออยู่ของแผนที่เจ้าหน้าที่ — ไม่มีโหมดบุคลากรอีกต่อไป */
const STAFF_MAP_MODES: readonly MapMode[] = ['overview', 'infection', 'safety']

export function LabMapStaffClient({ map, headerActions }: { map: StaffLabMapDTO; headerActions?: ReactNode }) {
  return (
    <LabMapShell
      map={map}
      allowedModes={STAFF_MAP_MODES}
      initialMode="overview"
      heading="แผนที่ห้องปฏิบัติการ ชั้น 3"
      description="ค้นหาห้อง โซน หรือหน่วยงานบนผังเดียวกับที่ผู้มาติดต่อและแผนผังหนีไฟใช้"
      eyebrow="STAFF MAP · กลุ่มงานเทคนิคการแพทย์"
      headerActions={headerActions}
    />
  )
}
