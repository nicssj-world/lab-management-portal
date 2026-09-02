'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import {
  ACTIVITY_LABEL,
  ACTIVITY_TYPES,
  CONTACT_DEPT_OTHER,
  GROUP_HEAD_CONTACT_DEPT,
  SAFETY_ACKS,
} from '@/lib/it-visitor/constants'
import type { VisitorFormConfig, VisitorFormOption, VisitorSafetyOption } from '@/lib/it-visitor/form-config'

type ListKey = 'activity_options' | 'contact_dept_options'

interface Props {
  initialConfig: VisitorFormConfig
  saving: boolean
  onClose: () => void
  onSave: (config: VisitorFormConfig) => Promise<boolean>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}

const builtInActivityLabels = ACTIVITY_TYPES.map((value) => ACTIVITY_LABEL[value])
const builtInDepartmentLabels = [...DEPARTMENTS, GROUP_HEAD_CONTACT_DEPT, CONTACT_DEPT_OTHER]

function cloneConfig(config: VisitorFormConfig): VisitorFormConfig {
  return {
    activity_options: config.activity_options.map((option) => ({ ...option })),
    contact_dept_options: config.contact_dept_options.map((option) => ({ ...option })),
    safety_policy_prompt: config.safety_policy_prompt,
    safety_options: config.safety_options.map((option) => ({ ...option })),
  }
}

function newOptionId(options: Array<{ id: string }>) {
  let id = ''
  do {
    id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  } while (options.some((option) => option.id === id))
  return id
}

function hasLabel(labels: string[], label: string) {
  const key = label.trim().toLocaleLowerCase()
  return labels.some((value) => value.trim().toLocaleLowerCase() === key)
}

export function VisitorFormOptionsEditor({ initialConfig, saving, onClose, onSave }: Props) {
  const [config, setConfig] = useState(() => cloneConfig(initialConfig))
  const [activityDraft, setActivityDraft] = useState('')
  const [departmentDraft, setDepartmentDraft] = useState('')
  const [safetyDraft, setSafetyDraft] = useState('')
  const [safetyOutcome, setSafetyOutcome] = useState<'acknowledged' | 'declined'>('acknowledged')
  const [error, setError] = useState('')

  function addOption(key: ListKey, rawLabel: string, clear: () => void) {
    const label = rawLabel.trim()
    if (!label) {
      setError('กรุณาระบุชื่อตัวเลือกก่อนเพิ่ม')
      return
    }

    const fixedLabels = key === 'activity_options' ? builtInActivityLabels : builtInDepartmentLabels
    const existing = config[key]
    if (hasLabel(fixedLabels, label) || hasLabel(existing.map((option) => option.label), label)) {
      setError('มีตัวเลือกชื่อนี้อยู่แล้ว')
      return
    }

    setConfig((current) => ({
      ...current,
      [key]: [...current[key], { id: newOptionId(current[key]), label }],
    }))
    clear()
    setError('')
  }

  function updateOption(key: ListKey, id: string, label: string) {
    setConfig((current) => ({
      ...current,
      [key]: current[key].map((option) => option.id === id ? { ...option, label } : option),
    }))
    setError('')
  }

  function removeOption(key: ListKey, id: string) {
    setConfig((current) => ({
      ...current,
      [key]: current[key].filter((option) => option.id !== id),
    }))
    setError('')
  }

  function addSafetyOption() {
    const label = safetyDraft.trim()
    if (!label) {
      setError('กรุณาระบุชื่อตัวเลือกก่อนเพิ่ม')
      return
    }
    if (hasLabel(config.safety_options.map((option) => option.label), label)) {
      setError('มีตัวเลือกนโยบายความปลอดภัยชื่อนี้อยู่แล้ว')
      return
    }
    setConfig((current) => ({
      ...current,
      safety_options: [...current.safety_options, { id: newOptionId(current.safety_options), label, outcome: safetyOutcome }],
    }))
    setSafetyDraft('')
    setError('')
  }

  function updateSafetyOption(id: string, patch: Partial<VisitorSafetyOption>) {
    setConfig((current) => ({
      ...current,
      safety_options: current.safety_options.map((option) => option.id === id ? { ...option, ...patch } : option),
    }))
    setError('')
  }

  function removeSafetyOption(id: string) {
    if (config.safety_options.length <= 1) return
    setConfig((current) => ({
      ...current,
      safety_options: current.safety_options.filter((option) => option.id !== id),
    }))
    setError('')
  }

  async function save() {
    if (config.safety_options.length < 1) {
      setError('ต้องมีตัวเลือกนโยบายความปลอดภัยอย่างน้อย 1 รายการ')
      return
    }
    const allOptions = [...config.activity_options, ...config.contact_dept_options, ...config.safety_options]
    if (allOptions.some((option) => !option.label.trim())) {
      setError('กรุณากรอกชื่อตัวเลือกให้ครบ หรือกดลบรายการที่ไม่ใช้')
      return
    }
    const duplicateSafety = config.safety_options.find((option, index) => config.safety_options.some((other, otherIndex) => (
      index !== otherIndex && other.label.trim().toLocaleLowerCase() === option.label.trim().toLocaleLowerCase()
    )))
    if (duplicateSafety) {
      setError('ไม่ควรมีตัวเลือกนโยบายความปลอดภัยชื่อซ้ำกัน')
      return
    }
    setError('')
    await onSave(cloneConfig(config))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-label="แก้ไขตัวเลือกฟอร์มสาธารณะ" style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>แก้ไขตัวเลือกฟอร์มสาธารณะ</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 12 }}>ตัวเลือกจะปรากฏในฟอร์มที่ผู้ใช้เปิดหรือโหลดใหม่จากลิงก์ QR หลังบันทึก</p>
          </div>
          <button type="button" aria-label="ปิดหน้าต่าง" title="ปิด" onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', width: 32, height: 32, borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 16 }}>
          <OptionGroup
            title="กิจกรรมที่เข้ามาดำเนินการ"
            description="รายการมาตรฐานยังคงอยู่ ตัวเลือกที่เพิ่มจะแสดงต่อท้ายรายการมาตรฐาน"
            options={config.activity_options}
            draft={activityDraft}
            placeholder="เช่น สอบเทียบเครื่องมือ"
            onDraftChange={setActivityDraft}
            onAdd={() => addOption('activity_options', activityDraft, () => setActivityDraft(''))}
            onUpdate={(id, label) => updateOption('activity_options', id, label)}
            onRemove={(id) => removeOption('activity_options', id)}
          />
          <OptionGroup
            title="หน่วยงานที่ต้องการติดต่อ"
            description="เพิ่มหน่วยงานที่ไม่มีอยู่ในรายการมาตรฐานได้ เช่น หน่วยงานภายนอกหรือทีมเฉพาะกิจ"
            options={config.contact_dept_options}
            draft={departmentDraft}
            placeholder="เช่น งานพัสดุ"
            onDraftChange={setDepartmentDraft}
            onAdd={() => addOption('contact_dept_options', departmentDraft, () => setDepartmentDraft(''))}
            onUpdate={(id, label) => updateOption('contact_dept_options', id, label)}
            onRemove={(id) => removeOption('contact_dept_options', id)}
          />

          <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <h3 style={{ margin: 0, color: 'var(--ink)', fontSize: 13.5, fontWeight: 800 }}>นโยบายความปลอดภัย</h3>
            <p style={{ margin: '5px 0 11px', color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5 }}>แก้ไขข้อความคำถามและข้อความตัวเลือกที่ผู้ใช้เห็นในฟอร์ม QR ได้ ตัวเลือกมาตรฐานจะลบไม่ได้</p>
            <label style={{ display: 'block', color: 'var(--muted)', fontSize: 11.5, fontWeight: 700, marginBottom: 5 }}>คำถามนโยบายความปลอดภัย</label>
            <textarea
              aria-label="คำถามนโยบายความปลอดภัย"
              style={{ ...inputStyle, minHeight: 74, resize: 'vertical' }}
              value={config.safety_policy_prompt}
              onChange={(event) => setConfig((current) => ({ ...current, safety_policy_prompt: event.target.value }))}
            />
            <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>
              {config.safety_options.map((option) => {
                const standard = SAFETY_ACKS.includes(option.id as typeof SAFETY_ACKS[number])
                return (
                  <div key={option.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 155px auto', gap: 7, alignItems: 'center' }}>
                    <input aria-label={`ชื่อตัวเลือกนโยบายความปลอดภัย ${option.label}`} style={inputStyle} value={option.label} onChange={(event) => updateSafetyOption(option.id, { label: event.target.value })} />
                    {standard ? (
                      <span style={{ color: 'var(--muted)', fontSize: 11.5, padding: '0 4px' }}>{option.outcome === 'acknowledged' ? 'ผล: รับทราบ' : 'ผล: ไม่ยินยอม'}</span>
                    ) : (
                      <select aria-label={`ผลของตัวเลือก ${option.label}`} style={inputStyle} value={option.outcome} onChange={(event) => updateSafetyOption(option.id, { outcome: event.target.value as 'acknowledged' | 'declined' })}>
                        <option value="acknowledged">ผล: รับทราบ</option>
                        <option value="declined">ผล: ไม่ยินยอม</option>
                      </select>
                    )}
                    <Button variant="danger" size="sm" onClick={() => removeSafetyOption(option.id)} disabled={config.safety_options.length <= 1} title={config.safety_options.length <= 1 ? 'ต้องเหลือตัวเลือกอย่างน้อย 1 รายการ' : undefined} aria-label={`ลบตัวเลือกนโยบายความปลอดภัย ${option.label}`}>ลบ</Button>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 155px auto', gap: 7, alignItems: 'center', marginTop: 10 }}>
              <input
                aria-label="เพิ่มตัวเลือกนโยบายความปลอดภัย"
                style={inputStyle}
                value={safetyDraft}
                placeholder="เช่น ไม่เกี่ยวข้องกับการเข้าพื้นที่"
                onChange={(event) => setSafetyDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSafetyOption() } }}
              />
              <select aria-label="ผลของตัวเลือกใหม่" style={inputStyle} value={safetyOutcome} onChange={(event) => setSafetyOutcome(event.target.value as 'acknowledged' | 'declined')}>
                <option value="acknowledged">ผล: รับทราบ</option>
                <option value="declined">ผล: ไม่ยินยอม</option>
              </select>
              <Button variant="secondary" size="sm" onClick={addSafetyOption}>เพิ่ม</Button>
            </div>
          </section>

          <div style={{ padding: 12, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            สำหรับตัวเลือกนโยบายความปลอดภัยที่เพิ่มใหม่ ให้เลือกผลกำกับด้วยว่าเป็น “รับทราบ” หรือ “ไม่ยินยอม” เพื่อให้ระบบสรุปสถานะและรายงานได้ถูกต้อง
          </div>
          {error && <div role="alert" style={{ padding: 11, borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <Button variant="secondary" onClick={onClose} disabled={saving}>ยกเลิก</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกตัวเลือก'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OptionGroup({ title, description, options, draft, placeholder, onDraftChange, onAdd, onUpdate, onRemove }: {
  title: string
  description: string
  options: VisitorFormOption[]
  draft: string
  placeholder: string
  onDraftChange: (value: string) => void
  onAdd: () => void
  onUpdate: (id: string, label: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
      <h3 style={{ margin: 0, color: 'var(--ink)', fontSize: 13.5, fontWeight: 800 }}>{title}</h3>
      <p style={{ margin: '5px 0 11px', color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5 }}>{description}</p>
      {options.length > 0 && (
        <div style={{ display: 'grid', gap: 7, marginBottom: 10 }}>
          {options.map((option) => (
            <div key={option.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 7, alignItems: 'center' }}>
              <input aria-label={`ชื่อตัวเลือก ${option.label}`} style={inputStyle} value={option.label} onChange={(event) => onUpdate(option.id, event.target.value)} />
              <Button variant="danger" size="sm" onClick={() => onRemove(option.id)} aria-label={`ลบตัวเลือก ${option.label}`}>ลบ</Button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 7, alignItems: 'center' }}>
        <input
          aria-label={`เพิ่ม${title}`}
          style={inputStyle}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onAdd() } }}
        />
        <Button variant="secondary" size="sm" onClick={onAdd}>เพิ่ม</Button>
      </div>
    </section>
  )
}
