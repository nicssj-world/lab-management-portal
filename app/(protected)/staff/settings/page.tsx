'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useLang } from '@/context/LangContext'

export default function SettingsPage() {
  const { lang, setLang } = useLang()
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="ระบบ" title="ตั้งค่าระบบ" subtitle="System Settings" />

      <Card padding={24}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>การแสดงผล</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Language */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>ภาษา / Language</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>ภาษาที่แสดงในระบบ</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['th', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
                    background: lang === l ? 'var(--primary)' : 'var(--surface-2)',
                    color: lang === l ? '#fff' : 'var(--ink)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {l === 'th' ? 'ภาษาไทย' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* About */}
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>เกี่ยวกับระบบ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'เวอร์ชัน', value: 'v1.0.0' },
                { label: 'ระบบ', value: 'Lab Management Portal · MN-LAB-01' },
                { label: 'หน่วยงาน', value: 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี' },
                { label: 'มาตรฐาน', value: 'ISO 15189 · ISO 15190' },
              ].map((item) => (
                <div key={item.label} style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="primary" onClick={handleSave}>
            {saved ? 'บันทึกแล้ว ✓' : 'บันทึกการตั้งค่า'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
