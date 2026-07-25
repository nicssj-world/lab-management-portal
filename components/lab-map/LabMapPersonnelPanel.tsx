'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LabMapAssignmentForm } from './LabMapAssignmentForm'
import type { StaffLabMapDTO } from '@/lib/lab-map/types'

export function LabMapPersonnelPanel({ selectedCode, map }: {
  selectedCode: string | null
  map: StaffLabMapDTO
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const assignment = selectedCode?.startsWith('person:')
    ? map.people?.find((person) => person.assignmentId === selectedCode.slice(7)) ?? null
    : null
  const targetCode = assignment?.spaceCode ?? assignment?.zoneCode ?? selectedCode
  const targetName = map.spaces.find((space) => space.code === targetCode)?.nameTh
    ?? map.zones.find((zone) => zone.code === targetCode)?.nameTh
    ?? null
  const peopleAtTarget = (map.people ?? []).filter((person) =>
    person.spaceCode === targetCode || person.zoneCode === targetCode,
  )

  async function remove(id: string) {
    setBusyId(id)
    const response = await fetch(`/api/admin/lab-map/person-assignments/${id}`, { method: 'DELETE' })
    setBusyId(null)
    if (response.ok) router.refresh()
  }

  return (
    <div className="lab-map-personnel-panel">
      <p className="lab-map-detail-type">PERSONNEL · RESPONSIBILITY</p>
      <h2>{assignment?.name ?? targetName ?? 'บุคลากรและพื้นที่รับผิดชอบ'}</h2>
      <p className="lab-map-personnel-note">พื้นที่หลัก/พื้นที่รับผิดชอบ — ไม่ใช่ตำแหน่งปัจจุบัน และไม่มีการติดตามบุคคลแบบเรียลไทม์</p>

      {assignment ? (
        <dl>
          <dt>หน่วยงาน</dt><dd>{assignment.department ?? 'ไม่ระบุ'}</dd>
          <dt>ประเภท</dt><dd>{assignment.assignmentType === 'primary' ? 'พื้นที่หลัก' : 'พื้นที่รับผิดชอบ'}</dd>
          <dt>พื้นที่</dt><dd>{targetName ?? targetCode}</dd>
        </dl>
      ) : targetName ? (
        <div className="lab-map-detail-block">
          <span>บุคลากรที่กำหนดกับพื้นที่นี้</span>
          {peopleAtTarget.length ? <ul>{peopleAtTarget.map((person) => <li key={person.assignmentId}>{person.name} · {person.assignmentType === 'primary' ? 'พื้นที่หลัก' : 'รับผิดชอบ'}</li>)}</ul> : <p>ยังไม่มีการกำหนดบุคลากร</p>}
        </div>
      ) : null}

      {(map.unassignedPeople?.length ?? 0) > 0 ? (
        <details><summary>ยังไม่ได้กำหนดพื้นที่ ({map.unassignedPeople?.length})</summary>
          <ul>{map.unassignedPeople?.map((person) => <li key={person.profileId}>{person.name}</li>)}</ul>
        </details>
      ) : null}

      {map.canEditPersonnelAssignments ? (
        <>
          {assignment ? <button className="lab-map-remove-assignment" type="button" disabled={busyId === assignment.assignmentId} onClick={() => remove(assignment.assignmentId)}>ยกเลิกการกำหนดพื้นที่นี้</button> : null}
          <LabMapAssignmentForm map={map} initialTargetCode={targetCode} />
        </>
      ) : null}
    </div>
  )
}
