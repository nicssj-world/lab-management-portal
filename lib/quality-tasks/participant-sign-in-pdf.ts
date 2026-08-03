export interface SignInParticipant {
  name: string
  positionTitle: string | null
  /** เช็คอินด้วย QR เมื่อไหร่ — null/undefined = ยังไม่เช็คอิน (เว้นช่องไว้ให้เซ็นสด) */
  checkedInAt?: string | null
  /** ตอนเช็คอินยังไม่อยู่ในรายชื่อผู้เข้าร่วมเดิม ระบบเพิ่มให้อัตโนมัติ */
  wasUnlisted?: boolean
}

export interface SignInHeader {
  /** หน่วยงาน — ของผู้รับผิดชอบกิจกรรม/การประชุมนี้ */
  department: string
  /** การประชุม — หมวดกิจกรรมคุณภาพ (categoryName ของ template) */
  meetingCategory: string
  /** เรื่อง — ชื่อกิจกรรม/การประชุม (title ของ template) */
  subject: string
}

const ROWS_PER_PAGE = 20
const DISPLAY_ROWS_PER_PAGE = 35

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatCheckInDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok' })
}

function buildPage(participants: SignInParticipant[], pageIndex: number, isLastPage: boolean, header: SignInHeader): string {
  const start = pageIndex * ROWS_PER_PAGE
  const rows = Array.from({ length: DISPLAY_ROWS_PER_PAGE }, (_, i) => {
    const rowNo = start + i
    const isParticipantRow = i < ROWS_PER_PAGE
    const person = isParticipantRow ? participants[rowNo] : undefined
    const displayNumber = isParticipantRow ? String(rowNo + 1) : ''
    const name = person ? escapeHtml(person.name) : ''
    const position = person?.positionTitle ? escapeHtml(person.positionTitle) : ''
    // เช็คอินด้วย QR แทนการเซ็นสด — พิมพ์ผลเช็คอินลงในช่องลายเซ็นต์/วันเดือนปีแทนการเว้นว่าง
    // ผู้เข้าร่วมที่ระบบเพิ่มให้อัตโนมัติ (ไม่อยู่ในรายชื่อเดิม) มีหมายเหตุกำกับไว้ให้ตรวจสอบย้อนหลังได้
    const signatureCell = person?.checkedInAt ? `<td class="c qt-checkin">${escapeHtml('✓ เช็คอิน QR')}</td>` : '<td></td>'
    const dateCell = person?.checkedInAt ? `<td class="c qt-checkin">${escapeHtml(formatCheckInDate(person.checkedInAt))}</td>` : '<td></td>'
    const remarkCell = person?.wasUnlisted ? `<td class="c qt-checkin">${escapeHtml('เพิ่มหน้างาน')}</td>` : '<td></td>'
    return `<tr><td class="c">${displayNumber}</td><td class="l">${name}</td><td class="l">${position}</td>${signatureCell}${dateCell}${remarkCell}</tr>`
  }).join('')

  return `<div class="qt-sign-page">
    <div class="qt-sign-title">แบบบันทึกใบลงนามรับทราบการสื่อสารเพื่อการพัฒนา</div>
    <div class="qt-sign-line"><b>หน่วยงาน</b> ${escapeHtml(header.department)} กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
    <div class="qt-sign-line"><b>การประชุม</b> ${escapeHtml(header.meetingCategory)} <b>เรื่อง</b> ${escapeHtml(header.subject)}</div>
    <table>
      <thead><tr><th>ลำดับที่</th><th>ชื่อ - สกุล</th><th>ตำแหน่ง</th><th>ลายเซ็นต์</th><th>วัน เดือน ปี</th><th>หมายเหตุ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="qt-sign-watermark">
      <span>กลุ่มงานเทคนิคการแพทย์</span>
      <span>โรงพยาบาลชลบุรี</span>
    </div>
    <div class="qt-sign-footer">
      <span class="qt-sign-footer-notice">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
      <span class="qt-sign-footer-code">Fm-QP-LAB-25/01</span>
    </div>
  </div>${isLastPage ? '' : ''}`
}

// Renders the FM-QP-LAB-25-01 sign-in sheet as a print-ready HTML document.
// ลำดับที่/ชื่อ-สกุล/ตำแหน่ง come from the personnel profile, and หน่วยงาน/การประชุม/เรื่อง
// come from `header` (resolved by the caller from the occurrence's responsible person's
// dept, template category, and template title) — none of the header line is left blank
// for manual fill-in anymore. ลายเซ็นต์/วันเดือนปี/หมายเหตุ stay blank/QR-stamped per row.
// Pages are fixed at 20 rows each — a resolved audience can realistically exceed 20
// (e.g. an all-departments meeting), so every page repeats the header/watermark/footer
// and only the LAST page pads with blank rows.
export function buildParticipantSignInHtml(participants: SignInParticipant[], header: SignInHeader): string {
  const pageCount = Math.max(1, Math.ceil(participants.length / ROWS_PER_PAGE))
  const pagesHtml = Array.from({ length: pageCount }, (_, pageIndex) =>
    buildPage(participants, pageIndex, pageIndex === pageCount - 1, header),
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบลงนามรับทราบการสื่อสาร</title><style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; font-size: 14pt; color: #000; }
    .qt-sign-page { page-break-after: always; position: relative; display: flex; flex-direction: column; width: 182mm; height: 273mm; margin: 0 auto; padding-top: 2mm; overflow: hidden; }
    .qt-sign-page:last-child { page-break-after: avoid; }
    .qt-sign-title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 6px; }
    .qt-sign-line { text-align: center; font-size: 14pt; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    th, td { border: 1px solid #000; padding: 2px 5px; font-size: 11.5pt; height: 24px; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    .c { text-align: center; }
    .l { text-align: left; }
    .qt-checkin { color: #1E5FAD; font-weight: bold; font-size: 10.5pt; }
    .qt-sign-watermark { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; pointer-events: none; z-index: -1; color: #9DBFD5; opacity: .22; font-size: 42pt; line-height: 1; font-weight: normal; white-space: nowrap; transform: scaleX(1.12); }
    .qt-sign-footer { display: flex; align-items: center; margin-top: auto; padding-top: 6px; font-size: 10pt; color: #333; }
    .qt-sign-footer-notice { flex: 1; text-align: center; }
    .qt-sign-footer-code { white-space: nowrap; }
  </style></head><body>${pagesHtml}</body></html>`
}
