'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'

type Profile = {
  id: string
  name: string
  role: string
  dept: string | null
  ephis_id: string | null
}

export function RiskTeamMembers({ profiles }: { profiles: Profile[] }) {
  const [memberIds, setMemberIds] = useState<Set<string> | null>(null)
  const [addingId, setAddingId] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/risk/team-members')
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage({ text: data.error ?? 'โหลดรายชื่อคณะทำงานไม่สำเร็จ', ok: false })
      setMemberIds(new Set())
      return
    }
    setMemberIds(new Set(Array.isArray(data.user_ids) ? data.user_ids.map(String) : []))
  }, [])

  useEffect(() => { void load() }, [load])

  const members = useMemo(
    () => profiles.filter(profile => memberIds?.has(profile.id)),
    [memberIds, profiles],
  )
  const candidates = useMemo(
    () => profiles.filter(profile => !memberIds?.has(profile.id)),
    [memberIds, profiles],
  )

  async function setMember(userId: string, enabled: boolean) {
    if (!memberIds) return
    setSavingId(userId)
    setMessage(null)
    const next = new Set(memberIds)
    if (enabled) next.add(userId)
    else next.delete(userId)
    setMemberIds(next)

    const response = await fetch('/api/admin/risk/team-members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, enabled }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingId(null)
    if (!response.ok) {
      setMemberIds(memberIds)
      setMessage({ text: data.error ?? 'บันทึกสมาชิกไม่สำเร็จ', ok: false })
      return
    }
    if (enabled) setAddingId('')
    setMessage({ text: enabled ? 'เพิ่มเข้าคณะทำงานความเสี่ยงแล้ว' : 'ถอนออกจากคณะทำงานความเสี่ยงแล้ว', ok: true })
  }

  return (
    <Card padding={0}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>ผู้ใช้งานในความเสี่ยง</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>กำหนดสมาชิกคณะทำงานความเสี่ยงเป็นรายบุคคล</div>
        </div>
        <Badge color="teal" size="sm">{members.length} คน</Badge>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.6 }}>
          <Icon name="shield" size={15} />
          <span>บุคลากรทุกคนที่มีบัญชีสามารถรายงานและจัดการ workflow IOR ได้ถึงการแก้ไข/ติดตามผล ส่วนสมาชิกคณะทำงานความเสี่ยงใช้จัดการทะเบียนความเสี่ยง ประเมินความเสี่ยงคงเหลือ และยืนยัน/ปิดทะเบียนได้ แต่การปิด IOR เป็นของ Manager/Admin</span>
        </div>

        {message && (
          <div role="status" style={{ marginBottom: 12, color: message.ok ? 'var(--success)' : 'var(--danger)', fontSize: 12.5 }}>
            {message.text}
          </div>
        )}

        {memberIds === null ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>กำลังโหลด…</div>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {members.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีสมาชิกคณะทำงาน</div>}
            {members.map(profile => (
              <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{profile.name}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--muted)' }}>
                    {profile.role}{profile.dept ? ` · ${profile.dept}` : ''}{profile.ephis_id ? ` · ${profile.ephis_id}` : ''}
                  </div>
                </div>
                <Button variant="ghost" size="sm" icon="trash" disabled={savingId === profile.id} onClick={() => void setMember(profile.id, false)}>
                  ถอนสิทธิ์
                </Button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select
            value={addingId}
            onChange={setAddingId}
            placeholder="— เลือกบุคลากร —"
            disabled={memberIds === null || candidates.length === 0}
            style={{ flex: 1 }}
            options={candidates.map(profile => ({
              value: profile.id,
              label: `${profile.name}${profile.ephis_id ? ` · ${profile.ephis_id}` : ''}`,
            }))}
          />
          <Button variant="primary" icon="plus" disabled={!addingId || savingId !== null} onClick={() => void setMember(addingId, true)}>
            เพิ่มสมาชิก
          </Button>
        </div>
      </div>
    </Card>
  )
}
