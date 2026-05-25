self.onmessage = function (e) {
  const { buffer } = e.data
  try {
    const text = new TextDecoder('utf-16le').decode(buffer)
    const lines = text.replace(/^﻿/, '').split('\r\n')
    const total = lines.length - 2

    const rows = []
    let invalid = 0

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const cols = lines[i].split('\t')
      const row = parseRow(cols)
      if (row) rows.push(row)
      else invalid++
      if (i % 2000 === 0) {
        self.postMessage({ type: 'progress', parsed: i, total })
      }
    }
    self.postMessage({ type: 'done', rows, invalid })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}

// Strip leading zeros from numeric HNs so both files match regardless of export format
function normalizeHn(hn) {
  if (!hn) return ''
  return /^\d+$/.test(hn) ? String(parseInt(hn, 10)) : hn
}

// ไฟล์ Phlebotomy: "DD/MM/YYYY  HH:MM:SS" (สอง space ระหว่างวันที่กับเวลา, ปี พ.ศ.)
// ต่างจากไฟล์ TAT ที่ใช้ "DD/MM/YYYY - HH:MM:SS"
function parseThaiDT(s) {
  if (!s) return null
  const m = s.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, d, mo, y, h, min, sec] = m
  const ceYear = +y - 543
  if (ceYear < 2000 || ceYear > 2100) return null
  return new Date(Date.UTC(ceYear, +mo - 1, +d, +h, +min, +sec)).toISOString()
}

// ไฟล์ Phlebotomy column index:
// 0=hn  1=confdate  2=conftime  3=confdatee  4=attaindatee
// 5=attaindate  6=attaintime  7=pt_dspname  8=pt_fname  9=pt_lname
// 10=labzoneno  11=opdptq_ptqno  12=labzoneno_name  13=labzone_name
// 14=confstf  15=sucessstf
//
// wait_minutes = attaindatee − confdatee (draw completion − queue registration)
// cols[3] confdatee   = queue registration datetime
// cols[4] attaindatee = draw completion datetime
function parseRow(cols) {
  const registerAt = parseThaiDT(cols[3])   // confdatee — queue registration
  const phlebDone  = parseThaiDT(cols[4])   // attaindatee — draw completed
  if (!registerAt || !phlebDone) return null

  const wait = (new Date(phlebDone) - new Date(registerAt)) / 60000
  if (wait < 0 || wait > 480) return null

  const hn = normalizeHn(cols[0]?.trim() || '')
  if (!hn) return null

  return {
    hn,
    register_at:   registerAt,
    phleb_done_at: phlebDone,
    wait_minutes:  Math.round(wait * 100) / 100,
    labzone_name:  cols[13]?.trim() || null,
    phlebotomist:  cols[15]?.trim() || null,
    phleb_date:    registerAt.slice(0, 10),
  }
}
