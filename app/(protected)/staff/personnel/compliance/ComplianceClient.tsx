'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'

export interface ComplianceData {
  generatedAt: string
  kpi: {
    trainingRate: number
    competencyPassRate: number
    jdCoverage: number
    competencyCoverage: number
  }
  summary: {
    staffCount: number; withLicense: number; licenseEligibleCount: number; licenseExpiring: number; licenseExpired: number
    certCount: number; certExpiring: number; certExpired: number
    compPassRate: number | null; compOverdue: number; trainingRecords: number; staffWithTraining: number
  }
  checklist: { clause: string; title: string; met: boolean; evidence: string }[]
  staffRows: {
    name: string; role: string; position: string; unit: string; license: string; licenseExpiry: string
    certCount: number; trainingCount: number; competencyCount: number
  }[]
}

export function ComplianceClient({ data }: { data: ComplianceData }) {
  const { summary, checklist, staffRows, kpi } = data
  const dateStr = new Date(data.generatedAt).toLocaleString('th-TH')

  function exportPdf() {
    const rows = staffRows.map((s, i) => `<tr>
      <td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.role)}</td><td>${esc(s.position)}</td>
      <td>${esc(s.unit)}</td><td>${esc(s.license)}</td><td>${esc(s.licenseExpiry)}</td>
      <td style="text-align:center">${s.certCount}</td><td style="text-align:center">${s.trainingCount}</td><td style="text-align:center">${s.competencyCount}</td>
    </tr>`).join('')
    const checkRows = checklist.map((c) => `<tr><td>${esc(c.clause)}</td><td>${esc(c.title)}</td><td>${c.met ? '✓' : '✗'}</td><td>${esc(c.evidence)}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Personnel Compliance</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; }
body { color: #0F172A; font-size: 14px; }
h1 { font-size: 20px; margin: 0 0 4px; } .muted { color: #64748B; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 13px; text-align: left; }
th { background: #f1f5f9; }
h2 { font-size: 15px; margin: 16px 0 4px; }
</style></head><body>
<h1>รายงานคุณภาพบุคลากร — กลุ่มงานเทคนิคการแพทย์</h1>
<div class="muted">กลุ่มงานเทคนิคการแพทย์ · ออกรายงาน ${esc(dateStr)} · บุคลากร ${summary.staffCount} คน</div>
<h2>เกณฑ์การตรวจประเมินคุณภาพบุคลากร</h2>
<table><thead><tr><th>ด้าน</th><th>หัวข้อ</th><th>สถานะ</th><th>หลักฐาน</th></tr></thead><tbody>${checkRows}</tbody></table>
<h2>ทะเบียนบุคลากร</h2>
<table><thead><tr><th>#</th><th>ชื่อ</th><th>บทบาท</th><th>ตำแหน่ง</th><th>หน่วยงาน</th><th>เลขใบอนุญาต</th><th>หมดอายุ</th><th>ใบรับรอง</th><th>อบรม</th><th>ประเมิน</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html; charset=utf-8' }))
    const win = window.open(blobUrl, '_blank')
    win?.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const checkWs = XLSX.utils.json_to_sheet(checklist.map((c) => ({ 'ข้อ': c.clause, 'หัวข้อ': c.title, 'สถานะ': c.met ? 'ผ่าน' : 'ยังไม่ครบ', 'หลักฐาน': c.evidence })))
    XLSX.utils.book_append_sheet(wb, checkWs, 'Checklist 6.2')
    const staffWs = XLSX.utils.json_to_sheet(staffRows.map((s, i) => ({
      '#': i + 1, 'ชื่อ': s.name, 'บทบาท': s.role, 'ตำแหน่ง': s.position, 'หน่วยงาน': s.unit,
      'เลขใบอนุญาต': s.license, 'หมดอายุ': s.licenseExpiry, 'ใบรับรอง': s.certCount, 'อบรม': s.trainingCount, 'ประเมิน': s.competencyCount,
    })))
    XLSX.utils.book_append_sheet(wb, staffWs, 'บุคลากร')
    XLSX.writeFile(wb, `personnel-compliance-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/staff/personnel" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}><Icon name="arrowLeft" size={16} /> บุคลากร</Link>
          <PageHeader eyebrow="คุณภาพบุคลากร" title="รายงานคุณภาพบุคลากร" subtitle={`ออกรายงาน ${dateStr}`} marginBottom={0} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportExcel} style={btn}><Icon name="download" size={15} /> Excel</button>
          <button onClick={exportPdf} style={{ ...btn, background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }}><Icon name="download" size={15} /> PDF</button>
        </div>
      </div>

      {/* summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Mini label="บุคลากร" value={summary.staffCount} />
        <Mini label="มีใบ ทนพ." value={`${summary.withLicense}/${summary.licenseEligibleCount}`} />
        <Mini label="ใบรับรองหมดอายุ" value={summary.certExpired} warn={summary.certExpired > 0} />
        <Mini label="ประเมินผ่าน" value={summary.compPassRate != null ? `${summary.compPassRate}%` : '—'} />
        <Mini label="ประเมินค้าง" value={summary.compOverdue} warn={summary.compOverdue > 0} />
        <Mini label="บันทึกอบรม" value={summary.trainingRecords} />
      </div>

      {/* KPI overview */}
      <Card padding={20}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>KPI ภาพรวมบุคลากร</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <Ring label="อัตราการอบรม" value={kpi.trainingRate} />
          <Ring label="ผ่านการประเมินสมรรถนะ" value={kpi.competencyPassRate} />
          <Ring label="ครอบคลุมการประเมิน" value={kpi.competencyCoverage} />
          <Ring label="JDJS ครบ (Active)" value={kpi.jdCoverage} />
        </div>
      </Card>

      {/* checklist */}
      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>เกณฑ์การตรวจประเมินคุณภาพบุคลากร</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>{['ด้าน', 'หัวข้อ', 'สถานะ', 'หลักฐาน'].map((h) => <th key={h} style={cth}>{h}</th>)}</tr></thead>
          <tbody>
            {checklist.map((c) => (
              <tr key={c.clause} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...ctd, fontFamily: 'monospace', fontWeight: 600 }}>{c.clause}</td>
                <td style={{ ...ctd, fontWeight: 600 }}>{c.title}</td>
                <td style={ctd}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: c.met ? 'var(--success)' : 'var(--danger)' }}>
                    <Icon name={c.met ? 'check' : 'x'} size={14} /> {c.met ? 'มีหลักฐาน' : 'ยังไม่ครบ'}
                  </span>
                </td>
                <td style={{ ...ctd, color: 'var(--muted)' }}>{c.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Ring({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)'
  const deg = Math.round((value / 100) * 360)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: `conic-gradient(${color} ${deg}deg, var(--surface-2) ${deg}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 66, height: 66, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color }}>{value}%</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

function Mini({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <Card padding={14}>
      <div style={{ fontSize: 21, fontWeight: 700, color: warn ? 'var(--danger)' : 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </Card>
  )
}

function esc(s: string) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)) }

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const cth: React.CSSProperties = { padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }
const ctd: React.CSSProperties = { padding: '11px 16px', color: 'var(--ink)', verticalAlign: 'top' }
