'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useLang } from '@/context/LangContext'
import { useSettings, SETTINGS_DEFAULTS, type SystemSettings } from '@/context/SettingsContext'

export default function SettingsPage() {
  const { lang, setLang } = useLang()
  const { settings, saveSettings } = useSettings()
  const [draft, setDraft] = useState<SystemSettings>(settings)
  const [saved, setSaved] = useState(false)

  function set(key: keyof SystemSettings, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    saveSettings(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border)', fontSize: 13,
    fontFamily: 'inherit', color: 'var(--ink)',
    background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="ระบบ" title="ตั้งค่าระบบ" subtitle="System Settings" />

      <Card padding={24}>
        {/* Language */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>การแสดงผล</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
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

        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

        {/* System info — editable */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>เกี่ยวกับระบบ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {([
            { key: 'siteName',   label: 'ชื่อระบบ' },
            { key: 'systemCode', label: 'รหัสระบบ' },
            { key: 'orgName',    label: 'หน่วยงาน' },
            { key: 'standards',  label: 'มาตรฐาน' },
            { key: 'version',    label: 'เวอร์ชัน' },
          ] as { key: keyof SystemSettings; label: string }[]).map(({ key, label }) => (
            <div key={key} style={key === 'orgName' ? { gridColumn: '1 / -1' } : {}}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                {label}
              </label>
              <input
                value={draft[key]}
                onChange={(e) => set(key, e.target.value)}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={() => setDraft(SETTINGS_DEFAULTS)}>รีเซ็ตค่าเริ่มต้น</Button>
          <Button variant="primary" onClick={handleSave}>
            {saved ? 'บันทึกแล้ว ✓' : 'บันทึกการตั้งค่า'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
