'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { AssigneePicker, type AssigneePerson } from '@/components/ui/AssigneePicker'

export function SatisfactionEditors() {
  const [people, setPeople] = useState<AssigneePerson[]>([])
  const [editorIds, setEditorIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/admin/satisfaction/editors')
      .then((response) => response.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPeople(data.people ?? [])
        setEditorIds(data.userIds ?? [])
      })
      .catch((caught) => setLoadError(caught instanceof Error ? caught.message : 'โหลดรายชื่อไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (userId: string, enabled: boolean) => {
    const response = await fetch('/api/admin/satisfaction/editors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, enabled }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'บันทึกไม่สำเร็จ')
    setEditorIds((current) => (enabled ? [...current, userId] : current.filter((id) => id !== userId)))
  }

  return (
    <Card padding={24}>
      {loadError && (
        <div role="alert" style={{ marginBottom: 14, padding: 10, borderRadius: 8, color: 'var(--danger)', background: 'rgba(220,38,38,.08)' }}>
          {loadError}
        </div>
      )}
      <AssigneePicker
        people={people}
        selectedIds={editorIds}
        onToggle={toggle}
        loading={loading}
        title="ผู้ได้รับมอบหมายแบบสำรวจความพึงพอใจ"
        description="คนในรายการนี้จะแก้ไขได้ทั้งโมดูล (สร้าง/แก้ไข/เผยแพร่แบบสำรวจ และสร้าง/เปิด/ปิดรอบเก็บข้อมูล) โดยไม่ต้องเปลี่ยน role — Admin และ Manager มีสิทธิ์อยู่แล้ว ส่วนการจัดการความคิดเห็นยังจำกัดเฉพาะ Admin และ Manager"
      />
    </Card>
  )
}
