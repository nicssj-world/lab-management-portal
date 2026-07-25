'use client'

import { useMemo } from 'react'
import { LabMapShell } from './LabMapShell'
import { LabMapPersonnelPanel } from './LabMapPersonnelPanel'
import type { MapMode, StaffLabMapDTO } from '@/lib/lab-map/types'

export function LabMapStaffClient({ map }: { map: StaffLabMapDTO }) {
  const allowedModes: readonly MapMode[] = map.people !== undefined
    ? ['overview', 'infection', 'safety', 'personnel']
    : ['overview', 'infection', 'safety']
  const personnelSearch = useMemo(() => (map.people ?? []).map((person) => ({
    code: `person:${person.assignmentId}`,
    label: person.name,
    type: 'บุคลากร',
    keywords: `${person.department ?? ''} ${person.spaceCode ?? ''} ${person.zoneCode ?? ''}`,
  })), [map.people])

  return (
    <>
      <style>{STAFF_MAP_CSS}</style>
      <LabMapShell
        map={map}
        allowedModes={allowedModes}
        initialMode="overview"
        heading="แผนที่ห้องปฏิบัติการ ชั้น 3"
        description="ค้นหาห้อง โซน หน่วยงาน หรือพื้นที่รับผิดชอบของบุคลากรบนผังเดียวกัน"
        eyebrow="STAFF MAP · กลุ่มงานเทคนิคการแพทย์"
        searchItems={personnelSearch}
        highlightedCodesForSelection={(selectedCode) => {
          const person = selectedCode?.startsWith('person:')
            ? map.people?.find((item) => item.assignmentId === selectedCode.slice(7))
            : null
          if (person?.spaceCode) return [person.spaceCode]
          if (person?.zoneCode) return map.zones.find((zone) => zone.code === person.zoneCode)?.spaceCodes ?? []
          return map.zones.find((zone) => zone.code === selectedCode)?.spaceCodes ?? []
        }}
        renderDetail={(selectedCode) => map.people !== undefined
          ? <LabMapPersonnelPanel selectedCode={selectedCode} map={map} />
          : null}
      />
    </>
  )
}

const STAFF_MAP_CSS = `
.lab-map-personnel-note{padding:10px 12px;border-left:3px solid var(--map-safety);background:#fff7dc;color:#654c08;font-size:.75rem;line-height:1.55}.lab-map-personnel-panel dl{display:grid;grid-template-columns:auto 1fr;gap:7px 12px;font-size:.78rem}.lab-map-personnel-panel dt{color:var(--map-muted)}.lab-map-personnel-panel dd{margin:0;font-weight:700}.lab-map-personnel-panel details{margin-top:18px;font-size:.76rem}.lab-map-assignment-form{display:grid;gap:10px;margin-top:20px;padding-top:18px;border-top:1px solid #e3eaec}.lab-map-assignment-form h3{margin:0;font-size:.86rem}.lab-map-assignment-form label{display:grid;gap:4px;color:var(--map-muted);font-size:.68rem}.lab-map-assignment-form select{width:100%;min-height:42px;border:1px solid #cbd8dc;border-radius:8px;background:#fff;padding:7px;color:#12324a;font:inherit}.lab-map-assignment-form button,.lab-map-remove-assignment{min-height:42px;border:0;border-radius:8px;background:#12324a;color:#fff;padding:8px 12px;font:700 .75rem "Noto Sans Thai",sans-serif;cursor:pointer}.lab-map-remove-assignment{width:100%;margin-top:15px;background:#8b2730}.lab-map-assignment-form p{margin:0;font-size:.7rem;color:var(--map-blue)}
`
