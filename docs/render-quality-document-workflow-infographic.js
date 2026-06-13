const fs = require('fs')
const sharp = require('sharp')

const W = 2400
const H = 1950
const regularFont = fs.readFileSync('C:/Windows/Fonts/THSarabun.ttf').toString('base64')
const boldFont = fs.readFileSync('C:/Windows/Fonts/THSarabun Bold.ttf').toString('base64')
const font = "'TH Sarabun Local','Tahoma','Arial',sans-serif"

function esc(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function text(lines, x, y, size = 32, fill = '#14213D', weight = 400, opts = {}) {
  const arr = Array.isArray(lines) ? lines : [lines]
  const lh = opts.lineHeight || Math.round(size * 1.12)
  const anchor = opts.anchor || 'start'
  return arr.map((line, i) =>
    `<text x="${x}" y="${y + i * lh}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(line)}</text>`
  ).join('\n')
}

function pill(label, x, y, fill) {
  return `<rect x="${x}" y="${y}" width="168" height="48" rx="24" fill="${fill}"/>${text(label, x + 84, y + 34, 32, '#fff', 800, { anchor: 'middle' })}`
}

function step(cx, cy, n, title, desc, color) {
  return `
  <circle cx="${cx}" cy="${cy}" r="32" fill="${color}"/>
  ${text(String(n), cx, cy + 10, 36, '#fff', 800, { anchor: 'middle' })}
  ${text(title, cx + 52, cy - 6, 36, '#172033', 800)}
  ${text(desc, cx + 52, cy + 31, 28, '#526075', 500, { lineHeight: 30 })}`
}

function flowCard(x, y, w, h, color, tag, title, subtitle, steps, foot) {
  const stepY = y + 255
  const gap = 115
  let s = `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30" fill="#FFFFFF" stroke="#D9E2EC" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${w}" height="104" rx="30" fill="${color}" opacity="0.12"/>
    <rect x="${x}" y="${y + 74}" width="${w}" height="30" fill="${color}" opacity="0.12"/>
    ${pill(tag, x + 34, y + 28, color)}
    ${text(title, x + 34, y + 140, 48, '#12213A', 800)}
    ${text(subtitle, x + 34, y + 184, 30, '#66758A', 500)}
  `
  steps.forEach((st, i) => {
    const cy = stepY + i * gap
    if (i > 0) s += `<path d="M ${x + 70} ${cy - gap + 38} L ${x + 70} ${cy - 40}" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity="0.30"/>`
    const desc = Array.isArray(st[1]) ? st[1] : st.slice(1)
    s += step(x + 70, cy, i + 1, st[0], desc, color)
  })
  s += `<rect x="${x + 28}" y="${y + h - 78}" width="${w - 56}" height="52" rx="18" fill="${color}" opacity="0.09"/>`
  s += text(foot, x + 50, y + h - 42, 31, '#334155', 800)
  s += '</g>'
  return s
}

const flow1 = [
  ['สร้าง Draft ปกติ', ['ใส่ Rev ที่ต้องการ', 'เช่น Rev.00 หรือ Rev.01']],
  ['Upload Source', ['Word/Excel ต้นฉบับ', 'วันที่ upload = Edit/Review Date']],
  ['DCC Upload PDF', ['QP/WI ใช้ PDF เนื้อหา', 'แบบไม่มีหน้าปก']],
  ['Review → Approved', ['ตรวจเอกสารและอนุมัติ', 'ระบบลงวันที่อนุมัติ']],
  ['Published', ['ระบบสร้าง cover + final PDF', 'แล้วตั้งเป็นไฟล์ทางการ']],
]
const flow2 = [
  ['เลือก Import Current', ['สร้างเป็น Published ทันที', 'ใส่ Rev ปัจจุบัน เช่น Rev.10']],
  ['Upload Official File', ['ไฟล์ทางการของ Rev ปัจจุบัน', 'ไม่ใช่ไฟล์ประวัติย้อนหลัง']],
  ['QP/WI: PDF มีหน้าปก', ['ใช้ไฟล์ทางการเดิม', 'ระบบไม่สร้าง cover ซ้ำ']],
  ['ตรวจ Master List', ['เช็คเลขเอกสาร/แผนก/สถานะ']],
  ['เพิ่ม history ย้อนหลัง', ['กรอก Rev.00-Rev.09', 'แนบไฟล์เก่าได้ถ้ามี']],
]
const flow3 = [
  ['Create Revision', ['เริ่มจากเอกสาร Published']],
  ['Working Draft', ['ระบบสร้าง Rev ถัดไป', 'และไม่กระทบ Rev ปัจจุบัน']],
  ['Upload ฉบับแก้ไข', ['Reviewer: Word/Excel', 'DCC: PDF/Official file']],
  ['Review → Approved', ['ตรวจและอนุมัติ revision draft']],
  ['Publish Rev ใหม่', ['Archive Rev เดิม', 'Promote Rev ใหม่เป็น current']],
]

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face { font-family: 'TH Sarabun Local'; src: url(data:font/truetype;charset=utf-8;base64,${regularFont}) format('truetype'); font-weight: 400; }
      @font-face { font-family: 'TH Sarabun Local'; src: url(data:font/truetype;charset=utf-8;base64,${boldFont}) format('truetype'); font-weight: 700 900; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F6FAFD"/>
      <stop offset="62%" stop-color="#EEF5F8"/>
      <stop offset="100%" stop-color="#F7F9FC"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#0F172A" flood-opacity="0.12"/>
    </filter>
    <pattern id="grid" width="54" height="54" patternUnits="userSpaceOnUse">
      <path d="M 54 0 L 0 0 0 54" fill="none" stroke="#C7D4E2" stroke-width="1" opacity="0.22"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <circle cx="2175" cy="145" r="270" fill="#1E5FAD" opacity="0.055"/>
  <circle cx="155" cy="1510" r="260" fill="#0F8C6F" opacity="0.055"/>

  ${text('ระบบเอกสารคุณภาพ', 88, 112, 82, '#0F172A', 900)}
  ${text('เลือก Flow ให้ถูกก่อนอัปโหลด', 88, 178, 58, '#1E5FAD', 800)}
  ${text('คู่มือสั้นสำหรับ Reviewer, DCC และผู้ดูแลระบบ · แยกไฟล์ทางการ / ไฟล์ต้นฉบับ / ประวัติย้อนหลัง / working revision ให้ชัดเจน', 88, 226, 33, '#526075', 500)}
  <rect x="1788" y="78" width="488" height="128" rx="28" fill="#FFFFFF" stroke="#D9E2EC"/>
  ${text('หลักจำง่าย', 1832, 130, 38, '#64748B', 800)}
  ${text('file_url = ไฟล์ทางการปัจจุบัน', 1832, 178, 36, '#0F172A', 800)}

  <g filter="url(#shadow)">
    ${flowCard(88, 290, 700, 900, '#1E5FAD', 'FLOW 01', 'Draft ตาม workflow ปกติ', 'Rev.00 หรือ Rev.>0 ที่เริ่มจาก Word/Excel', flow1, 'เหมาะกับ source-first workflow')}
    ${flowCard(850, 290, 700, 900, '#D97706', 'FLOW 02', 'Import Current Rev.>0', 'เอกสารเก่าที่ต้องนำเข้าเป็น Published ทันที', flow2, 'เพิ่ม history ย้อนหลังได้')}
    ${flowCard(1612, 290, 700, 900, '#0F8C6F', 'FLOW 03', 'อัปเดต เพิ่ม Rev.', 'แก้เนื้อหาเอกสารที่ Published แล้ว', flow3, 'ห้ามแก้ไฟล์ Published ตรง ๆ')}
  </g>

  <rect x="88" y="1242" width="2224" height="320" rx="32" fill="#0F172A"/>
  ${text('ข้อควรจำก่อนกดส่งต่อ', 132, 1310, 52, '#FFFFFF', 900)}
  <line x1="132" y1="1342" x2="2268" y2="1342" stroke="#FFFFFF" opacity="0.18"/>
  ${text(['01  Word/Excel คือ source file เท่านั้น ห้าม promote ทับ file_url อัตโนมัติ', '02  Flow 01 ใช้ได้ทั้ง Rev.00 และ Rev.>0 เมื่อเริ่มจาก DOCX/XLSX', '03  QP/WI ต้องมี PDF เนื้อหาไม่มีหน้าปก ก่อนเข้า Review และระบบสร้าง cover ตอน Published', '04  Fm/Rf/Cf ไม่ต้องมีหน้าปก ไม่ stamp signature แต่ยังควบคุม revision/status ได้', '05  Backfill history ใช้เฉพาะเอกสารเก่าที่เคยแก้ไขมาก่อน สิทธิ์ Admin + DCC'], 132, 1390, 32, '#E5EEF8', 700, { lineHeight: 36 })}

  <rect x="88" y="1606" width="1070" height="190" rx="28" fill="#FFFFFF" stroke="#D9E2EC"/>
  ${text('บทบาทหลัก', 132, 1666, 46, '#12213A', 900)}
  ${text(['Reviewer: upload Word/Excel ฉบับร่างหรือฉบับแก้ไข', 'DCC: ตรวจควบคุมเอกสาร, upload official/PDF, เพิ่มประวัติย้อนหลัง', 'Approver: อนุมัติเอกสารก่อน Published'], 132, 1706, 31, '#465568', 700, { lineHeight: 34 })}

  <rect x="1242" y="1606" width="1070" height="190" rx="28" fill="#FFFFFF" stroke="#D9E2EC"/>
  ${text('จุดตรวจสำคัญ', 1286, 1666, 46, '#12213A', 900)}
  ${text(['ตรวจเลขเอกสาร, ประเภท, แผนก, revision, วันที่, ผู้จัดทำ/รับรอง/อนุมัติ', 'Rev.>0 ที่เริ่มจาก DOCX/XLSX ให้ใช้ Flow 01 ไม่ใช่ Import Current', 'ถ้า Import Current ให้เพิ่มประวัติย้อนหลังหลังนำเข้าปัจจุบัน'], 1286, 1706, 31, '#465568', 700, { lineHeight: 34 })}

  <text x="1200" y="1908" font-family="${font}" font-size="30" font-weight="700" fill="#7B8794" text-anchor="middle">Quality Document Workflow V2 · Chonburi Hospital Lab Management Portal</text>
</svg>`

sharp(Buffer.from(svg)).png().toFile('docs/quality-document-workflow-infographic.png').then(() => {
  console.log('created docs/quality-document-workflow-infographic.png')
}).catch(err => {
  console.error(err)
  process.exit(1)
})
