import autoTable from 'jspdf-autotable'
import type { jsPDF } from 'jspdf'
import { createThaiPdfDoc } from '@/lib/external-quality/export'
import { LAB_MAP_SPACE_OPTIONS } from '@/lib/lab-map/space-options'
import {
  ACTION_STATUSES, ACTION_TYPES, INCIDENT_STATUSES, LEVEL_LABEL, RCA_FACTORS, RCA_METHODS,
  REGISTER_STATUSES, SEVERITY_DESCRIPTIONS, formatThaiDate, statusMeta,
  type SeverityLetter,
} from '@/components/risk/shared/tokens'

const MARGIN = 14
const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const PRIMARY: [number, number, number] = [30, 95, 173]
const PANEL: [number, number, number] = [241, 244, 249]
const BORDER: [number, number, number] = [229, 234, 240]
const SUCCESS: [number, number, number] = [22, 163, 74]

/** jspdf-autotable ผูก `lastAutoTable.finalY` ไว้กับ instance ของ jsPDF ที่ runtime — ไม่มีอยู่ใน type declaration */
function finalY(doc: jsPDF) {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30
}

function printedAt() {
  return new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })
}

function heading(doc: jsPDF, y: number, text: string) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y > pageHeight - 25) { doc.addPage(); y = 18 }
  doc.setFont('Sarabun', 'normal')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(text, MARGIN, y)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y + 2, doc.internal.pageSize.getWidth() - MARGIN, y + 2)
  return y + 8
}

function kvTable(doc: jsPDF, startY: number, rows: [string, string][]) {
  autoTable(doc, {
    startY,
    body: rows,
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 9, cellPadding: 2.4, overflow: 'linebreak', textColor: INK, lineColor: BORDER },
    columnStyles: { 0: { cellWidth: 46, fontStyle: 'normal', textColor: MUTED, fillColor: PANEL }, 1: { cellWidth: 'auto' } },
  })
  return finalY(doc) + 6
}

function textBlock(doc: jsPDF, startY: number, label: string, value: string) {
  autoTable(doc, {
    startY,
    head: [[label]],
    body: [[value || '—']],
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 9.5, cellPadding: 3, overflow: 'linebreak', textColor: INK, lineColor: BORDER },
    headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: PANEL, textColor: MUTED, fontSize: 8.5 },
  })
  return finalY(doc) + 6
}

export type PdfAction = {
  action_type: string
  description: string
  owner: string | null
  due_date: string | null
  status: string
  result: string | null
  is_effective: boolean | null
}

/**
 * ตารางหลายคอลัมน์ (7 คอลัมน์) บีบข้อความไทยจนตัดคำกลางพยางค์ เพราะภาษาไทยไม่มีช่องว่างระหว่างคำ
 * ให้ jsPDF ตัดบรรทัดตามความกว้างคอลัมน์แคบ ๆ ไม่ได้ — เปลี่ยนเป็นการ์ดเต็มความกว้างต่อ 1 มาตรการแทน
 * ตรงกับหน้าตาของ ActionCard บนจอ (คำอธิบายเป็นหัวเรื่อง ตามด้วยเมทาดาทาบรรทัดเดียว)
 */
function actionsTable(doc: jsPDF, startY: number, actions: PdfAction[]) {
  if (!actions.length) {
    autoTable(doc, {
      startY,
      body: [['ยังไม่มีมาตรการแก้ไข']],
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 9, cellPadding: 3, overflow: 'linebreak', textColor: MUTED, lineColor: BORDER },
    })
    return finalY(doc) + 6
  }

  let y = startY
  actions.forEach((a, i) => {
    const typeLabel = ACTION_TYPES.find(t => t.value === a.action_type)?.label ?? a.action_type
    const statusLabel = ACTION_STATUSES.find(s => s.value === a.status)?.label ?? a.status
    const effectiveLabel = a.is_effective === true ? 'ได้ผล' : a.is_effective === false ? 'ไม่ได้ผล' : null

    // แต่ละบรรทัดเป็นคู่ label/value แยกคอลัมน์ — ไม่ยัดรวมเป็นข้อความเดียว เพราะเซลล์เดียวใน jsPDF
    // ใส่สีสองสีในบรรทัดเดียวไม่ได้ การแยกคอลัมน์คือวิธีเดียวที่ทำให้หัวข้อกับคำตอบแยกสีกันจริง ๆ
    const body: [string, string][] = [
      ['ประเภท', typeLabel],
      ['ผู้รับผิดชอบ', a.owner ?? 'ไม่ระบุ'],
      ['กำหนด', formatThaiDate(a.due_date)],
      ['สถานะ', effectiveLabel ? `${statusLabel} · ${effectiveLabel}` : statusLabel],
    ]
    if (a.result) body.push(['ผลติดตาม', a.result])

    autoTable(doc, {
      startY: y,
      head: [[{ content: `${i + 1}. ${a.description}`, colSpan: 2 }]],
      body,
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 9, cellPadding: 2.4, overflow: 'linebreak', textColor: INK, lineColor: BORDER },
      headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: PRIMARY, textColor: 255, fontSize: 9.5 },
      columnStyles: { 0: { cellWidth: 42, textColor: MUTED, fillColor: PANEL }, 1: { cellWidth: 'auto', textColor: INK } },
    })
    y = finalY(doc) + 4
  })
  return y + 2
}

export type PdfAttachment = { file_name: string; uploaded_at: string }

function attachmentsTable(doc: jsPDF, startY: number, attachments: PdfAttachment[]) {
  autoTable(doc, {
    startY,
    head: [['ไฟล์หลักฐาน', 'อัปโหลดเมื่อ']],
    body: attachments.length
      ? attachments.map(a => [a.file_name, formatThaiDate(a.uploaded_at?.slice(0, 10))])
      : [['ยังไม่มีไฟล์หลักฐาน', '']],
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 8.5, cellPadding: 1.8, overflow: 'linebreak', textColor: INK, lineColor: BORDER },
    headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: PANEL, textColor: MUTED },
    columnStyles: { 1: { cellWidth: 35 } },
  })
  return finalY(doc) + 6
}

export type IncidentPdfRecord = {
  id: number
  report_no: string | null
  event_date: string
  event_time: string | null
  reporter_name: string | null
  reporter_position: string | null
  department_found: string | null
  department_target: string | null
  event_category: string | null
  event_detail: string
  immediate_correction: string | null
  severity_level: string | null
  requires_rca: boolean
  status: string
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_note: string | null
  rca_method: string | null
  root_cause: string | null
  rca_factors: Record<string, boolean> | null
  effectiveness_result: string | null
  closed_by_name: string | null
  closed_at: string | null
}

/** สรุปอุบัติการณ์เดียวเป็น PDF หน้าเดียว (ต่อได้หลายหน้าถ้าเนื้อหายาว) — ตรงกับข้อมูลที่เห็นใน IncidentDetailModal */
export function buildIncidentDetailPdf(incident: IncidentPdfRecord, actions: PdfAction[], attachments: PdfAttachment[]): Buffer {
  const doc = createThaiPdfDoc('portrait')

  doc.setFontSize(16)
  doc.setTextColor(...INK)
  doc.text(`${incident.report_no ?? `#${incident.id}`} · ${incident.event_category || 'อุบัติการณ์'}`, MARGIN, 16)
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  const eventWhen = `${formatThaiDate(incident.event_date)}${incident.event_time ? ` ${incident.event_time.slice(0, 5)} น.` : ''}`
  doc.text(`${eventWhen} · ${incident.department_found ?? 'ไม่ระบุหน่วยงาน'}`, MARGIN, 22)
  doc.setFontSize(8)
  doc.text(`สรุปรายงานอุบัติการณ์ (ISO 15189 8.7) · พิมพ์เมื่อ ${printedAt()}`, MARGIN, 27)

  let y = 33
  const severityLabel = incident.severity_level
    ? `${incident.severity_level} — ${SEVERITY_DESCRIPTIONS[incident.severity_level as SeverityLetter] ?? ''}`
    : 'ยังไม่ได้ทบทวน'

  y = kvTable(doc, y, [
    ['สถานะ', statusMeta(INCIDENT_STATUSES, incident.status).label],
    ['ระดับความรุนแรง', severityLabel],
    ['ผู้รายงาน', [incident.reporter_name, incident.reporter_position].filter(Boolean).join(' · ') || '—'],
    ['ส่งถึงหน่วยงาน', incident.department_target ?? '—'],
    ['ต้องวิเคราะห์รากของปัญหา (RCA)', incident.requires_rca ? 'ใช่' : 'ไม่บังคับ'],
  ])

  y = textBlock(doc, y, 'เกิดเหตุการณ์อย่างไร', incident.event_detail)
  if (incident.immediate_correction) y = textBlock(doc, y, 'การแก้ไขเฉพาะหน้า', incident.immediate_correction)

  y = heading(doc, y, 'การทบทวน')
  if (incident.reviewed_at) {
    y = kvTable(doc, y, [
      ['ผู้ทบทวน', incident.reviewed_by_name ?? 'ไม่ระบุ'],
      ['วันที่ทบทวน', formatThaiDate(incident.reviewed_at.slice(0, 10))],
    ])
    if (incident.review_note) y = textBlock(doc, y, 'บันทึกการทบทวน', incident.review_note)
  } else {
    y = textBlock(doc, y, 'สถานะ', 'ยังไม่ได้ทบทวน')
  }

  if (incident.requires_rca) {
    y = heading(doc, y, 'วิเคราะห์รากของปัญหา (RCA)')
    const factorLabels = RCA_FACTORS.filter(f => incident.rca_factors?.[f.key]).map(f => f.label)
    y = kvTable(doc, y, [
      ['วิธีวิเคราะห์', RCA_METHODS.find(m => m.value === incident.rca_method)?.label ?? incident.rca_method ?? '—'],
      ['ปัจจัยเชิงระบบ', factorLabels.length ? factorLabels.join(', ') : '—'],
    ])
    y = textBlock(doc, y, 'รากของปัญหา', incident.root_cause ?? '')
  }

  y = heading(doc, y, 'มาตรการแก้ไขและการติดตาม')
  y = actionsTable(doc, y, actions)

  y = heading(doc, y, 'สรุปผลการติดตามประสิทธิผล')
  y = textBlock(doc, y, 'ผลโดยรวม', incident.effectiveness_result ?? '')

  y = heading(doc, y, 'ไฟล์หลักฐาน')
  y = attachmentsTable(doc, y, attachments)

  if (incident.status === 'closed') {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (y > pageHeight - 20) { doc.addPage(); y = 18 }
    doc.setFontSize(9)
    doc.setTextColor(...SUCCESS)
    doc.text(`ปิดเรื่องโดย ${incident.closed_by_name ?? 'ไม่ระบุ'} เมื่อ ${formatThaiDate(incident.closed_at?.slice(0, 10))}`, MARGIN, y)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

export type RegisterPdfRecord = {
  id: number
  risk_no: string | null
  assessed_date: string
  department: string | null
  space_code: string | null
  hazard_category: string | null
  process_step: string | null
  risk_statement: string
  affected_parties: string | null
  causes: string | null
  existing_controls: string | null
  additional_controls: string | null
  reference_docs: string | null
  likelihood: number | null
  impact: number | null
  score: number | null
  level: string | null
  residual_likelihood: number | null
  residual_impact: number | null
  residual_score: number | null
  residual_level: string | null
  residual_assessed_by_name: string | null
  residual_assessed_at: string | null
  risk_accepted_by_name: string | null
  owner: string | null
  status: string
  next_review_date: string | null
  last_reviewed_at: string | null
  last_reviewed_by_name: string | null
}

/** สรุปความเสี่ยงรายการเดียวเป็น PDF — ตรงกับข้อมูลที่เห็นใน RegisterDetailModal */
export function buildRegisterDetailPdf(
  entry: RegisterPdfRecord,
  actions: PdfAction[],
  attachments: PdfAttachment[],
  sourceIncidents: { id: number; report_no: string | null }[],
): Buffer {
  const doc = createThaiPdfDoc('portrait')
  const spaceLabel = LAB_MAP_SPACE_OPTIONS.find(([code]) => code === entry.space_code)?.[1]

  doc.setFontSize(16)
  doc.setTextColor(...INK)
  doc.text(`${entry.risk_no ?? `#${entry.id}`} · ${entry.process_step || 'ความเสี่ยง'}`, MARGIN, 16)
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(`ประเมินเมื่อ ${formatThaiDate(entry.assessed_date)} · ${entry.department ?? 'ไม่ระบุหน่วยงาน'}`, MARGIN, 22)
  doc.setFontSize(8)
  doc.text(`สรุปทะเบียนความเสี่ยง (ISO 15189 8.5) · พิมพ์เมื่อ ${printedAt()}`, MARGIN, 27)

  let y = 33
  y = kvTable(doc, y, [
    ['สถานะ', statusMeta(REGISTER_STATUSES, entry.status).label],
    ['หมวดอันตราย', entry.hazard_category ?? '—'],
    ['กระบวนการ/จุดงาน', entry.process_step ?? '—'],
    ['ผู้ได้รับผลกระทบ', entry.affected_parties ?? '—'],
    ['ผู้รับผิดชอบ', entry.owner ?? '—'],
    ['ห้องบนแผนที่', spaceLabel ?? 'ไม่ระบุ / นอกแผนที่'],
  ])

  y = textBlock(doc, y, 'เหตุการณ์ความเสี่ยง', entry.risk_statement)

  if (sourceIncidents.length) {
    y = textBlock(doc, y, 'ยกระดับมาจากอุบัติการณ์', sourceIncidents.map(i => i.report_no ?? `#${i.id}`).join(', '))
  }

  y = heading(doc, y, 'การประเมินก่อนมาตรการ')
  y = kvTable(doc, y, [
    ['โอกาสเกิด (Likelihood)', entry.likelihood != null ? String(entry.likelihood) : '—'],
    ['ผลกระทบ (Impact)', entry.impact != null ? String(entry.impact) : '—'],
    ['คะแนนความเสี่ยง', entry.score != null ? String(entry.score) : '—'],
    ['ระดับ', entry.level ? LEVEL_LABEL[entry.level as keyof typeof LEVEL_LABEL] : '—'],
  ])

  y = heading(doc, y, 'สาเหตุและมาตรการควบคุม')
  y = textBlock(doc, y, 'สาเหตุ', entry.causes ?? '')
  y = textBlock(doc, y, 'มาตรการที่มีอยู่', entry.existing_controls ?? '')
  y = textBlock(doc, y, 'มาตรการเพิ่มเติมที่ต้องทำ', entry.additional_controls ?? '')
  y = textBlock(doc, y, 'เอกสารอ้างอิง', entry.reference_docs ?? '')

  y = heading(doc, y, 'มาตรการและการติดตาม')
  y = actionsTable(doc, y, actions)

  y = heading(doc, y, 'ความเสี่ยงคงเหลือหลังมาตรการ (Residual Risk)')
  y = kvTable(doc, y, [
    ['โอกาสเกิดหลังมาตรการ', entry.residual_likelihood != null ? String(entry.residual_likelihood) : '—'],
    ['ผลกระทบหลังมาตรการ', entry.residual_impact != null ? String(entry.residual_impact) : '—'],
    ['คะแนนคงเหลือ', entry.residual_score != null ? String(entry.residual_score) : '—'],
    ['ระดับคงเหลือ', entry.residual_level ? LEVEL_LABEL[entry.residual_level as keyof typeof LEVEL_LABEL] : '—'],
    ['ผู้ยอมรับความเสี่ยงคงเหลือ', entry.risk_accepted_by_name ?? '—'],
    ['ประเมินโดย', entry.residual_assessed_by_name
      ? `${entry.residual_assessed_by_name} · ${formatThaiDate(entry.residual_assessed_at?.slice(0, 10))}`
      : '—'],
  ])

  y = heading(doc, y, 'ไฟล์หลักฐาน')
  y = attachmentsTable(doc, y, attachments)

  if (entry.last_reviewed_at) {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (y > pageHeight - 20) { doc.addPage(); y = 18 }
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(`ทบทวนล่าสุดโดย ${entry.last_reviewed_by_name ?? 'ไม่ระบุ'} เมื่อ ${formatThaiDate(entry.last_reviewed_at.slice(0, 10))}`, MARGIN, y)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
