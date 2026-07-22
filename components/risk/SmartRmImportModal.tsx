'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { RiskDropzone } from './shared/RiskDropzone'
import { ErrorBanner, Modal } from './shared/ui'
import { FONT, SPACE, tabularNums } from './shared/tokens'
import { SMART_RM_HEADERS, normalizeIsoDate } from '@/lib/risk/smart-rm'

type PreviewRow = Record<string, unknown>
type Result = { inserted: number; updated: number; total: number }

const PREVIEW_LIMIT = 8

export function SmartRmImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const [result, setResult] = useState<Result | null>(null)

  async function readFile(file: File) {
    setError('')
    setIssues([])
    setResult(null)
    setReading(true)
    setFileName(file.name)
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
      const sheet = workbook.Sheets['All Risk'] ?? workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error('ไม่พบชีตข้อมูลในไฟล์')

      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const mapped = raw
        .map(row => ({
          external_no: String(row['หมายเลข'] ?? '').trim(),
          event_date: normalizeIsoDate(row['วันที่เกิดเหตุ']),
          recorded_date: normalizeIsoDate(row['วันที่บันทึก']),
          department_found: row['สถานที่เกิดเหตุ'],
          department_target: row['หน่วยงานที่ต้องการส่งถึง'],
          risk_type: row['ประเภทความเสี่ยง'],
          event_main_category: row['ประเภทของเหตุการณ์ หัวข้อหลัก'],
          event_sub_category: row['ประเภทของเหตุการณ์ หัวข้อย่อย'],
          severity_level: row['ระดับความรุนแรง RM'],
          event_detail: row['เกิดเหตุการณ์อย่างไร'],
          ior_status: row['สถานะ IOR'],
        }))
        .filter(row => row.external_no)

      if (mapped.length === 0) {
        throw new Error('อ่านไฟล์ได้ แต่ไม่พบแถวที่มีคอลัมน์ "หมายเลข" — ตรวจว่าใช้ template Smart-RM หรือไม่')
      }
      setRows(mapped)
    } catch (err) {
      setRows([])
      setError((err as Error).message)
    } finally {
      setReading(false)
    }
  }

  async function commit() {
    setUploading(true)
    setError('')
    setIssues([])
    try {
      const res = await fetch('/api/admin/risk/smart-rm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (Array.isArray(json.errors) && json.errors.length > 0) {
          setIssues(json.errors)
          throw new Error(`พบปัญหา ${json.errors.length} แถว — ยังไม่ได้นำเข้าข้อมูล`)
        }
        throw new Error(json.error ?? 'นำเข้าข้อมูลไม่สำเร็จ')
      }
      setResult({ inserted: json.inserted, updated: json.updated, total: json.total })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  if (result) {
    return (
      <Modal
        title="นำเข้าข้อมูลสำเร็จ"
        onClose={onImported}
        width={520}
        footer={<><span /><Button variant="primary" icon="check" onClick={onImported}>เสร็จสิ้น</Button></>}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md, color: 'var(--success)' }}>
          <Icon name="shieldCheck" size={22} />
          <span style={{ fontSize: FONT.lg, fontWeight: 700 }}>
            ประมวลผล <span style={tabularNums}>{result.total.toLocaleString('th-TH')}</span> รายการจาก {fileName}
          </span>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm, margin: 0 }}>
          <ResultStat label="เพิ่มใหม่" value={result.inserted} />
          <ResultStat label="อัปเดตของเดิม" value={result.updated} />
        </dl>
        <p style={{ marginTop: SPACE.md, marginBottom: 0, fontSize: FONT.base, color: 'var(--muted)', lineHeight: 1.6 }}>
          รายการที่มีหมายเลขเดิมอยู่แล้วจะถูกอัปเดตด้วยข้อมูลจากไฟล์ล่าสุด
          จึงนำเข้าไฟล์เดิมซ้ำได้โดยข้อมูลไม่ซ้ำซ้อน
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      title="นำเข้าข้อมูล Smart-RM"
      subtitle="อ่านชีต All Risk แล้วอัปเดตรายการตามคอลัมน์ หมายเลข"
      onClose={onClose}
      width={720}
      dirty={rows.length > 0}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>ยกเลิก</Button>
          <Button variant="primary" icon="upload" onClick={commit} disabled={rows.length === 0 || uploading || reading}>
            {uploading ? 'กำลังนำเข้า…' : `นำเข้า ${rows.length.toLocaleString('th-TH')} รายการ`}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <RiskDropzone
          accept=".xlsx,.xls,.csv"
          disabled={uploading}
          onFiles={files => void readFile(files[0])}
          title={fileName || 'คลิกหรือลากไฟล์ .xlsx / .csv มาวางที่นี่'}
          hint="ต้องมีคอลัมน์ตาม template Smart-RM"
          detail={SMART_RM_HEADERS.join(' · ')}
        />

        <ErrorBanner message={error} />

        {issues.length > 0 && (
          <div style={{ padding: SPACE.sm, borderRadius: 10, border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)', background: 'color-mix(in srgb, var(--danger) 6%, var(--card))' }}>
            <p style={{ margin: `0 0 ${SPACE.xs}px`, fontSize: FONT.md, fontWeight: 700, color: 'var(--danger)' }}>
              แก้ไขปัญหาต่อไปนี้ในไฟล์แล้วนำเข้าใหม่
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: FONT.base, color: 'var(--danger)', lineHeight: 1.7 }}>
              {issues.slice(0, 10).map((issue, i) => <li key={i}>{issue}</li>)}
              {issues.length > 10 && <li>และอีก {issues.length - 10} รายการ</li>}
            </ul>
          </div>
        )}

        {reading && <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.md }}>กำลังอ่านไฟล์…</p>}

        {rows.length > 0 && (
          <div>
            <p style={{ margin: `0 0 ${SPACE.xs}px`, fontWeight: 700, color: 'var(--ink)', fontSize: FONT.md }}>
              ตัวอย่าง {Math.min(PREVIEW_LIMIT, rows.length)} จาก {rows.length.toLocaleString('th-TH')} รายการ
            </p>
            <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620, fontSize: FONT.base }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {['หมายเลข', 'วันที่เกิดเหตุ', 'RM', 'เหตุการณ์'].map(h => (
                      <th key={h} scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontSize: FONT.xs, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...previewTd, ...tabularNums }}>{String(row.external_no ?? '')}</td>
                      <td style={{ ...previewTd, ...tabularNums }}>{String(row.event_date ?? '—')}</td>
                      <td style={previewTd}>{String(row.severity_level ?? '—')}</td>
                      <td style={{ ...previewTd, color: 'var(--muted)' }}>{String(row.event_detail ?? '').slice(0, 90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

const previewTd: React.CSSProperties = { padding: '8px 12px', color: 'var(--ink)', verticalAlign: 'top' }

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: SPACE.sm, borderRadius: 10, background: 'var(--surface-2)' }}>
      <dt style={{ color: 'var(--muted)', fontSize: FONT.xs, fontWeight: 600 }}>{label}</dt>
      <dd style={{ ...tabularNums, margin: '4px 0 0', color: 'var(--ink)', fontSize: FONT.xl, fontWeight: 700 }}>
        {value.toLocaleString('th-TH')}
      </dd>
    </div>
  )
}
