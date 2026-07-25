import type { ItVisitorLogWithRefs } from '@/lib/supabase/types'
import {
  ACTIVITY_LABEL, APPOINTMENT_LABEL, BADGE_LABEL, ORG_TYPE_LABEL, VISIT_TYPE_LABEL,
} from './constants'

const ROWS_PER_PAGE = 16

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function headerRow(): string {
  return `<tr>
    <th class="no">ลำดับ</th>
    <th class="date">วันที่</th>
    <th class="time">เข้า</th>
    <th class="time">ออก</th>
    <th class="type">ประเภท</th>
    <th class="name">ชื่อ-สกุล / คณะ</th>
    <th class="org">หน่วยงาน / บริษัท</th>
    <th class="dept">ติดต่อหน่วยงาน</th>
    <th class="qty">จำนวน</th>
    <th class="act">กิจกรรม</th>
    <th class="chk">นัด</th>
    <th class="chk">บัตร</th>
    <th class="chk">ปลอดภัย</th>
  </tr>`
}

function dataRow(row: ItVisitorLogWithRefs, index: number): string {
  const who = row.visit_type === 'group' && row.group_name
    ? `${row.group_name} (${row.visitor_name})`
    : row.visitor_name
  const activity = row.activity_type === 'other' && row.activity_other
    ? row.activity_other
    : ACTIVITY_LABEL[row.activity_type]
  return `<tr>
    <td class="no">${index + 1}</td>
    <td class="date">${fmtDate(row.visit_date)}</td>
    <td class="time">${fmtTime(row.entered_at)}</td>
    <td class="time">${row.exited_at ? fmtTime(row.exited_at) : '-'}</td>
    <td class="type">${escapeHtml(VISIT_TYPE_LABEL[row.visit_type])}</td>
    <td class="name">${escapeHtml(who)}</td>
    <td class="org">${escapeHtml(row.org_name)}<br><span class="sub">${escapeHtml(ORG_TYPE_LABEL[row.org_type])}</span></td>
    <td class="dept">${escapeHtml(row.contact_dept)}</td>
    <td class="qty">${row.party_size}</td>
    <td class="act">${escapeHtml(activity)}</td>
    <td class="chk">${row.appointment === 'booked' ? '✓' : '-'}</td>
    <td class="chk">${row.badge_exchanged === 'yes' ? '✓' : '-'}</td>
    <td class="chk">${row.safety_ack === 'acknowledged' ? '✓' : '✗'}</td>
  </tr>`
}

function blankRow(): string {
  return `<tr><td class="no"></td><td class="date"></td><td class="time"></td><td class="time"></td><td class="type"></td><td class="name"></td><td class="org"></td><td class="dept"></td><td class="qty"></td><td class="act"></td><td class="chk"></td><td class="chk"></td><td class="chk"></td></tr>`
}

function buildPage(
  rows: ItVisitorLogWithRefs[],
  pageIndex: number,
  isLastPage: boolean,
  rangeLabel: string,
  printedAt: string,
): string {
  const start = pageIndex * ROWS_PER_PAGE
  const pageRows = rows.slice(start, start + ROWS_PER_PAGE)
  const body = pageRows.map((r, i) => dataRow(r, start + i)).join('')
  // เติมแถวว่างเฉพาะหน้าสุดท้าย เพื่อให้ตารางสั้น ๆ ยังเต็มกรอบ
  const padding = isLastPage
    ? Array.from({ length: Math.max(0, ROWS_PER_PAGE - pageRows.length) }, () => blankRow()).join('')
    : ''

  return `<div class="page">
    <div class="head">
      <div class="head-title">ทะเบียนบันทึกการเข้า-ออก กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
      <div class="head-meta"><span>ช่วงข้อมูล: ${escapeHtml(rangeLabel)}</span><span>พิมพ์เมื่อ: ${escapeHtml(printedAt)}</span><span>รวม ${rows.length} รายการ</span></div>
    </div>
    <table>
      <thead>${headerRow()}</thead>
      <tbody>${body}${padding}</tbody>
    </table>
    <div class="legend">หมายเหตุ: คอลัมน์ "นัด" = นัดหมายล่วงหน้า · "บัตร" = แลกบัตรที่สำนักงาน · "ปลอดภัย" ✓ = รับทราบนโยบายความปลอดภัยแล้ว, ✗ = ไม่ยินยอมศึกษาข้อมูล</div>
    <div class="footer">
      <span class="footer-notice">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
      <span class="footer-page">หน้า ${pageIndex + 1}</span>
    </div>
  </div>`
}

/** ทะเบียนพร้อมพิมพ์ (A4 แนวนอน) — คอลัมน์เยอะจึงใช้แนวนอนเหมือน Fm-QP-LAB-24/01 */
export function buildVisitorRegisterHtml(
  rows: ItVisitorLogWithRefs[],
  range: { from: string; to: string },
): string {
  const rangeLabel = range.from || range.to
    ? `${range.from ? fmtDate(range.from) : 'เริ่มต้น'} — ${range.to ? fmtDate(range.to) : 'ปัจจุบัน'}`
    : 'ทั้งหมด'
  const printedAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE))
  const pagesHtml = Array.from({ length: pageCount }, (_, i) =>
    buildPage(rows, i, i === pageCount - 1, rangeLabel, printedAt),
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ทะเบียนบันทึกการเข้า-ออก</title><style>
    @page { size: A4 landscape; margin: 8mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; font-size: 12pt; color: #000; }
    .page { page-break-after: always; display: flex; flex-direction: column; width: 277mm; min-height: 190mm; margin: 0 auto; }
    .page:last-child { page-break-after: avoid; }
    .head { margin-bottom: 6px; }
    .head-title { font-size: 13pt; font-weight: bold; text-align: center; }
    .head-meta { display: flex; justify-content: center; gap: 18px; margin-top: 3px; font-size: 9.5pt; color: #333; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 2px 4px; font-size: 9.5pt; vertical-align: middle; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    td { height: 20px; }
    .no   { width: 30px;  text-align: center; }
    .date { width: 62px;  text-align: center; }
    .time { width: 42px;  text-align: center; }
    .type { width: 52px;  text-align: center; }
    .name { min-width: 130px; }
    .org  { min-width: 120px; }
    .dept { min-width: 110px; }
    .qty  { width: 38px;  text-align: center; }
    .act  { min-width: 110px; }
    .chk  { width: 34px;  text-align: center; }
    .sub  { font-size: 8pt; color: #444; }
    .legend { margin-top: 6px; font-size: 8.5pt; color: #333; }
    .footer { display: flex; align-items: center; margin-top: auto; padding-top: 4px; font-size: 8pt; color: #333; }
    .footer-notice { flex: 1; }
    .footer-page { white-space: nowrap; }
  </style></head><body>${pagesHtml}</body></html>`
}
