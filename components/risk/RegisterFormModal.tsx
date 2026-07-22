'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ScalePicker, ScoreReadout } from './shared/ScalePicker'
import { ErrorBanner, Field, Modal } from './shared/ui'
import {
  IMPACT_SCALE, LAB_DEPARTMENTS, LEVEL_LABEL, LIKELIHOOD_SCALE, SPACE,
  inputStyle, riskLevel, riskScore, textareaStyle, todayIso,
} from './shared/tokens'

const LEVEL_TONE_VAR: Record<string, string> = {
  low: 'var(--success)',
  medium: 'var(--warning)',
  high: 'var(--danger)',
}

const EMPTY = {
  risk_no: '',
  assessed_date: todayIso(),
  department: '',
  hazard_category: '',
  process_step: '',
  risk_statement: '',
  affected_parties: '',
  causes: '',
  existing_controls: '',
  additional_controls: '',
  reference_docs: '',
  owner: '',
}

export function RegisterFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(EMPTY)
  const [likelihood, setLikelihood] = useState<number | null>(null)
  const [impact, setImpact] = useState<number | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const statementError = touched.risk_statement && !draft.risk_statement.trim()
    ? 'ต้องกรอกเหตุการณ์ความเสี่ยง' : undefined

  const level = riskLevel(riskScore(likelihood, impact))
  const set = (patch: Partial<typeof EMPTY>) => setDraft({ ...draft, ...patch })

  async function save() {
    setTouched({ risk_statement: true })
    if (!draft.risk_statement.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/risk/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null])),
          assessed_date: draft.assessed_date,
          risk_statement: draft.risk_statement.trim(),
          likelihood,
          impact,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="เพิ่มความเสี่ยงเข้าทะเบียน"
      subtitle="ประเมินเชิงรุกด้วยโอกาสเกิด × ผลกระทบ ตาม ISO 15189 ข้อ 8.5"
      onClose={onClose}
      width={860}
      dirty={JSON.stringify(draft) !== JSON.stringify(EMPTY) || likelihood !== null || impact !== null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button variant="primary" icon="check" onClick={() => void save()} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <ErrorBanner message={error} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: SPACE.xs }}>
          <Field label="รหัสความเสี่ยง" hint="เช่น BIO-01 เว้นว่างได้">
            <input value={draft.risk_no} onChange={e => set({ risk_no: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="วันที่ประเมิน" required>
            <input type="date" value={draft.assessed_date} onChange={e => set({ assessed_date: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="หน่วยงาน">
            <select value={draft.department} onChange={e => set({ department: e.target.value })} style={inputStyle}>
              <option value="">— เลือกหน่วยงาน —</option>
              {LAB_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="หมวดอันตราย" hint="เช่น ชีวภาพ เคมี กายภาพ">
            <input value={draft.hazard_category} onChange={e => set({ hazard_category: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="กระบวนการ/จุดงาน" hint="เช่น รับสิ่งส่งตรวจ ปั่นเหวี่ยง ทิ้งขยะ">
            <input value={draft.process_step} onChange={e => set({ process_step: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="ผู้รับผิดชอบ">
            <input value={draft.owner} onChange={e => set({ owner: e.target.value })} style={inputStyle} />
          </Field>
        </div>

        <Field
          label="เหตุการณ์ความเสี่ยง"
          required
          error={statementError}
          hint="เขียนในรูป ถ้า…จะทำให้… เช่น ถ้าหลอดเลือดแตกระหว่างปั่น จะทำให้เจ้าหน้าที่สัมผัสสารคัดหลั่ง"
        >
          <textarea
            value={draft.risk_statement}
            onChange={e => set({ risk_statement: e.target.value })}
            onBlur={() => setTouched({ ...touched, risk_statement: true })}
            style={textareaStyle}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: SPACE.sm }}>
          <ScalePicker legend="โอกาสเกิด (Likelihood)" name="new-likelihood" scale={LIKELIHOOD_SCALE} value={likelihood} onChange={setLikelihood} />
          <ScalePicker legend="ผลกระทบ (Impact)" name="new-impact" scale={IMPACT_SCALE} value={impact} onChange={setImpact} />
        </div>
        <ScoreReadout
          label="คะแนนความเสี่ยง"
          likelihood={likelihood}
          impact={impact}
          level={level ? LEVEL_LABEL[level] : null}
          tone={level ? LEVEL_TONE_VAR[level] : 'var(--muted)'}
        />

        <Field label="ผู้ได้รับผลกระทบ" hint="เจ้าหน้าที่ / ผู้ป่วย / ผู้มาเยี่ยม / สิ่งแวดล้อม">
          <input value={draft.affected_parties} onChange={e => set({ affected_parties: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="สาเหตุ">
          <textarea value={draft.causes} onChange={e => set({ causes: e.target.value })} style={{ ...textareaStyle, minHeight: 64 }} />
        </Field>
        <Field label="มาตรการที่มีอยู่">
          <textarea value={draft.existing_controls} onChange={e => set({ existing_controls: e.target.value })} style={{ ...textareaStyle, minHeight: 64 }} />
        </Field>
        <Field label="มาตรการเพิ่มเติมที่ต้องทำ">
          <textarea value={draft.additional_controls} onChange={e => set({ additional_controls: e.target.value })} style={{ ...textareaStyle, minHeight: 64 }} />
        </Field>
        <Field label="เอกสารอ้างอิง" hint="SOP / WI / แบบฟอร์ม / บันทึกอบรม / SDS">
          <input value={draft.reference_docs} onChange={e => set({ reference_docs: e.target.value })} style={inputStyle} />
        </Field>
      </div>
    </Modal>
  )
}
