'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StaffLabMapDTO } from '@/lib/lab-map/types'

export function LabMapAssignmentForm({ map, initialTargetCode }: {
  map: StaffLabMapDTO
  initialTargetCode?: string | null
}) {
  const router = useRouter()
  const profiles = useMemo(() => {
    const byId = new Map<string, { profileId: string; name: string; department: string | null }>()
    for (const person of map.people ?? []) byId.set(person.profileId, person)
    for (const person of map.unassignedPeople ?? []) byId.set(person.profileId, person)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [map.people, map.unassignedPeople])
  const defaultTarget = map.spaces.some((space) => space.code === initialTargetCode)
    ? `space:${initialTargetCode}`
    : map.zones.some((zone) => zone.code === initialTargetCode)
      ? `zone:${initialTargetCode}`
      : ''
  const [profileId, setProfileId] = useState('')
  const [assignmentType, setAssignmentType] = useState<'primary' | 'responsible'>('primary')
  const [target, setTarget] = useState(defaultTarget)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!profileId || !target) return setMessage('กรุณาเลือกบุคลากรและพื้นที่')
    const [kind, code] = target.split(':', 2)
    setSaving(true)
    setMessage('')
    const response = await fetch('/api/admin/lab-map/person-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId,
        assignmentType,
        spaceCode: kind === 'space' ? code : null,
        zoneCode: kind === 'zone' ? code : null,
      }),
    })
    const result = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return setMessage(result.error ?? 'บันทึกไม่สำเร็จ')
    setMessage('บันทึกพื้นที่แล้ว')
    router.refresh()
  }

  return (
    <form className="lab-map-assignment-form" onSubmit={submit}>
      <h3>กำหนดพื้นที่บุคลากร</h3>
      <label>บุคลากร
        <select value={profileId} onChange={(event) => setProfileId(event.target.value)} required>
          <option value="">— เลือกบุคลากร —</option>
          {profiles.map((profile) => <option key={profile.profileId} value={profile.profileId}>{profile.name}</option>)}
        </select>
      </label>
      <label>ประเภท
        <select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as 'primary' | 'responsible')}>
          <option value="primary">พื้นที่หลัก</option>
          <option value="responsible">พื้นที่รับผิดชอบ</option>
        </select>
      </label>
      <label>ห้องหรือโซน
        <select value={target} onChange={(event) => setTarget(event.target.value)} required>
          <option value="">— เลือกพื้นที่ —</option>
          <optgroup label="ห้อง / พื้นที่">
            {map.spaces.map((space) => <option key={space.code} value={`space:${space.code}`}>{space.nameTh}</option>)}
          </optgroup>
          <optgroup label="โซน">
            {map.zones.map((zone) => <option key={zone.code} value={`zone:${zone.code}`}>{zone.nameTh}</option>)}
          </optgroup>
        </select>
      </label>
      <button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'เพิ่มการกำหนดพื้นที่'}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  )
}
