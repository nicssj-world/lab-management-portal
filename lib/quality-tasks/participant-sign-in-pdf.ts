export interface SignInParticipant {
  name: string
  positionTitle: string | null
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

function buildPage(participants: SignInParticipant[], pageIndex: number, isLastPage: boolean): string {
  const start = pageIndex * ROWS_PER_PAGE
  const rows = Array.from({ length: DISPLAY_ROWS_PER_PAGE }, (_, i) => {
    const rowNo = start + i
    const isParticipantRow = i < ROWS_PER_PAGE
    const person = isParticipantRow ? participants[rowNo] : undefined
    const displayNumber = isParticipantRow ? String(rowNo + 1) : ''
    const name = person ? escapeHtml(person.name) : ''
    const position = person?.positionTitle ? escapeHtml(person.positionTitle) : ''
    return `<tr><td class="c">${displayNumber}</td><td class="l">${name}</td><td class="l">${position}</td><td></td><td></td><td></td></tr>`
  }).join('')

  return `<div class="qt-sign-page">
    <div class="qt-sign-title">แบบบันทึกใบลงนามรับทราบการสื่อสารเพื่อการพัฒนา</div>
    <div class="qt-sign-line">หน่วยงาน .............................................. กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
    <div class="qt-sign-line">การประชุม .................................................................. เรื่อง ............................................</div>
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
// Only ลำดับที่/ชื่อ-สกุล/ตำแหน่ง are auto-filled from the personnel profile;
// ลายเซ็นต์/วันเดือนปี/หมายเหตุ and the
// หน่วยงาน/การประชุม/เรื่อง header lines stay blank for manual fill-in at print time.
// Pages are fixed at 20 rows each — a resolved audience can realistically exceed 20
// (e.g. an all-departments meeting), so every page repeats the header/watermark/footer
// and only the LAST page pads with blank rows.
export function buildParticipantSignInHtml(participants: SignInParticipant[]): string {
  const pageCount = Math.max(1, Math.ceil(participants.length / ROWS_PER_PAGE))
  const pagesHtml = Array.from({ length: pageCount }, (_, pageIndex) =>
    buildPage(participants, pageIndex, pageIndex === pageCount - 1),
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
    .qt-sign-watermark { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; pointer-events: none; z-index: -1; color: #9DBFD5; opacity: .22; font-size: 42pt; line-height: 1; font-weight: normal; white-space: nowrap; transform: scaleX(1.12); }
    .qt-sign-footer { display: flex; align-items: center; margin-top: auto; padding-top: 6px; font-size: 10pt; color: #333; }
    .qt-sign-footer-notice { flex: 1; text-align: center; }
    .qt-sign-footer-code { white-space: nowrap; }
  </style></head><body>${pagesHtml}</body></html>`
}
