'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { AssigneePicker, type AssigneePerson } from '@/components/ui/AssigneePicker'
import { SatisfactionInlineError } from './SatisfactionPrimitives'

export function SatisfactionEditors() {
  const [people, setPeople] = useState<AssigneePerson[]>([])
  const [editorIds, setEditorIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  const loadEditors = useCallback(async () => {
    setLoading(true); setLoadError('')
    try {
      const response = await fetch('/api/admin/satisfaction/editors')
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error ?? 'โหลดรายชื่อไม่สำเร็จ')
      setPeople(data.people ?? [])
      setEditorIds(data.userIds ?? [])
    } catch (caught) { setLoadError(caught instanceof Error ? caught.message : 'โหลดรายชื่อไม่สำเร็จ') } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadEditors() }, [loadEditors])

  const toggle = async (userId: string, enabled: boolean) => {
    setToggleBusyId(userId); setLoadError(''); setStatusMessage('')
    try {
      const response = await fetch('/api/admin/satisfaction/editors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enabled }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'บันทึกไม่สำเร็จ')
      setEditorIds((current) => (enabled ? [...current, userId] : current.filter((id) => id !== userId)))
      setStatusMessage(enabled ? 'เพิ่มผู้ดูแลแล้ว' : 'ถอนผู้ดูแลแล้ว')
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ')
      throw caught
    } finally { setToggleBusyId(null) }
  }

  return (
    <Card padding={24}>
      {loadError && <div style={{ marginBottom: 14 }}><SatisfactionInlineError message={loadError} onRetry={() => void loadEditors()} /></div>}
      {statusMessage && <div className="satisfaction-settings-success" aria-live="polite">{statusMessage}</div>}
      <AssigneePicker
        people={people}
        selectedIds={editorIds}
        onToggle={toggle}
        loading={loading}
        title="ผู้ได้รับมอบหมายแบบสำรวจความพึงพอใจ"
        description="คนในรายการนี้จะแก้ไขได้ทั้งโมดูล (สร้าง/แก้ไข/เผยแพร่แบบสำรวจ และสร้าง/เปิด/ปิดรอบเก็บข้อมูล) โดยไม่ต้องเปลี่ยน role — Admin และ Manager มีสิทธิ์อยู่แล้ว ส่วนการจัดการความคิดเห็นยังจำกัดเฉพาะ Admin และ Manager"
      />
      <div className="satisfaction-visually-hidden" aria-live="polite">{toggleBusyId ? 'กำลังบันทึกสิทธิ์…' : ''}</div>
    </Card>
  )
}
