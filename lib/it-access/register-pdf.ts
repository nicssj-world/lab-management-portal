import type { ItAccessRecordWithProfile, ItSystem } from '@/lib/supabase/types'
import { PERMISSION_COLUMNS } from '@/lib/it-access/columns'

// Controlled-form identity. Changes only when the paper template revision changes.
const FORM_CODE = 'Fm-QP-LAB-24/01'

const ROWS_PER_PAGE = 18

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Two-row grouped header matching the paper form: User ID (HIS/LIS) spans HIS|LIS,
// ระดับการใช้งานระบบ HIS/LIS spans the permission columns; name/position/note span both rows.
function headerRows(): string {
  const permCount = PERMISSION_COLUMNS.length
  const permHeads = PERMISSION_COLUMNS.map((c) => `<th class="v"><span>${escapeHtml(c.label)}</span></th>`).join('')
  return `<tr>
      <th colspan="2">User ID (HIS/LIS)</th>
      <th rowspan="2" class="name">ชื่อ - สกุล</th>
      <th rowspan="2" class="pos">ตำแหน่ง</th>
      <th colspan="${permCount}">ระดับการใช้งานระบบ HIS/LIS</th>
      <th rowspan="2" class="note">หมายเหตุ</th>
    </tr>
    <tr>
      <th class="id">HIS</th>
      <th class="id">LIS</th>
      ${permHeads}
    </tr>`
}

function dataRow(record: ItAccessRecordWithProfile, orderedSystems: ItSystem[]): string {
  const p = record.profile
  const his = p?.ephis_id ? escapeHtml(p.ephis_id) : '-'
  const lis = record.lis_user_id ? escapeHtml(record.lis_user_id) : '-'
  const name = p?.name ? escapeHtml(p.name) : ''
  const pos = p?.position_title ? escapeHtml(p.position_title) : ''
  const perms = PERMISSION_COLUMNS.map((c) => `<td class="chk">${record[c.key] ? '✓' : ''}</td>`).join('')
  // Sorted by the systems' own display_order (HIS first), not the stored array order.
  const systems = orderedSystems.filter((s) => record.system_ids.includes(s.id)).map((s) => s.name).join(', ')
  return `<tr>
    <td class="id">${his}</td>
    <td class="id">${lis}</td>
    <td class="name">${name}</td>
    <td class="pos">${pos}</td>
    ${perms}
    <td class="note">${escapeHtml(systems)}</td>
  </tr>`
}

function blankRow(): string {
  const cells = PERMISSION_COLUMNS.map(() => '<td class="chk"></td>').join('')
  return `<tr><td class="id"></td><td class="id"></td><td class="name"></td><td class="pos"></td>${cells}<td class="note"></td></tr>`
}

function signatureBlock(): string {
  const dateLine = 'วันที่ ......../.........../..............'
  return `<div class="sig">
    <div class="sig-col">
      <div class="sig-line">ผู้ทบทวน ...........................................</div>
      <div>(..........................................)</div>
      <div>คณะทำงานระบบสารสนเทศห้องปฏิบัติการ</div>
      <div>${dateLine}</div>
    </div>
    <div class="sig-col">
      <div class="sig-line">ผู้อนุมัติ ...........................................</div>
      <div>(..........................................)</div>
      <div>หัวหน้ากลุ่มงานเทคนิคการแพทย์</div>
      <div>${dateLine}</div>
    </div>
  </div>`
}

function buildPage(
  records: ItAccessRecordWithProfile[],
  pageIndex: number,
  isLastPage: boolean,
  orderedSystems: ItSystem[],
): string {
  const start = pageIndex * ROWS_PER_PAGE
  const pageRecords = records.slice(start, start + ROWS_PER_PAGE)
  const rows = pageRecords.map((r) => dataRow(r, orderedSystems)).join('')
  // Pad only the last page so short registers still fill the grid.
  const padding = isLastPage
    ? Array.from({ length: Math.max(0, ROWS_PER_PAGE - pageRecords.length) }, () => blankRow()).join('')
    : ''

  return `<div class="page">
    <table>
      <thead>
        <tr><th class="grand" colspan="${4 + PERMISSION_COLUMNS.length + 1}">การกำหนดสิทธิ์ในการเข้าถึงข้อมูลในระบบสารสนเทศ HIS &amp; LIS กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</th></tr>
        ${headerRows()}
      </thead>
      <tbody>${rows}${padding}</tbody>
    </table>
    ${isLastPage ? signatureBlock() : ''}
    <div class="footer">
      <span class="footer-notice">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
      <span class="footer-code">${FORM_CODE}</span>
    </div>
  </div>`
}

// Print-ready register replicating Fm-QP-LAB-24/01 (A4 landscape).
export function buildItAccessRegisterHtml(records: ItAccessRecordWithProfile[], systems: ItSystem[]): string {
  // HIS first, then each system's own display_order — regardless of the order stored per record.
  const orderedSystems = [...systems].sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
  const pageCount = Math.max(1, Math.ceil(records.length / ROWS_PER_PAGE))
  const pagesHtml = Array.from({ length: pageCount }, (_, i) =>
    buildPage(records, i, i === pageCount - 1, orderedSystems),
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ทะเบียนสิทธิ์ HIS &amp; LIS</title><style>
    @page { size: A4 landscape; margin: 8mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; font-size: 12pt; color: #000; }
    .page { page-break-after: always; display: flex; flex-direction: column; width: 277mm; min-height: 190mm; margin: 0 auto; }
    .page:last-child { page-break-after: avoid; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 1px 3px; font-size: 10.5pt; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; vertical-align: middle; }
    td { height: 18px; }
    .grand { font-size: 12.5pt; background: #fff; padding: 3px; }
    th.v { height: 74px; padding: 2px; }
    th.v span { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; display: inline-block; font-size: 8.5pt; }
    .id { width: 46px; text-align: center; }
    .name { min-width: 150px; }
    .pos { min-width: 130px; font-size: 10pt; }
    .chk { width: 30px; text-align: center; font-size: 10.5pt; }
    .note { min-width: 130px; font-size: 10pt; }
    td.name, td.pos, td.note { text-align: left; }
    .sig { display: flex; justify-content: center; gap: 45mm; margin-top: 34px; text-align: center; font-size: 10.5pt; }
    .sig-col { width: 85mm; }
    .sig-col > div { margin-bottom: 4px; }
    .sig-line { font-weight: bold; }
    .footer { display: flex; align-items: center; margin-top: auto; padding-top: 4px; font-size: 8pt; color: #333; }
    .footer-notice { flex: 1; text-align: center; }
    .footer-code { white-space: nowrap; }
  </style></head><body>${pagesHtml}</body></html>`
}
