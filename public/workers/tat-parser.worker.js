self.onmessage = function (e) {
  const { buffer } = e.data
  try {
    const text = new TextDecoder('utf-16le').decode(buffer)
    const lines = text.replace(/^﻿/, '').split('\r\n')
    const total = lines.length - 2

    const rows = []
    let invalid = 0

    const headers = lines[0].split('\t').map(normalizeHeader)

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const cols = lines[i].split('\t')
      const row = parseRow(cols, headers)
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

function parseThaiDT(s) {
  if (!s) return null
  const m = s.trim().match(/(\d+)\/(\d+)\/(\d+) - (\d+):(\d+):(\d+)/)
  if (!m) return null
  const [, d, mo, y, h, min, sec] = m
  // Buddhist Era year → CE year
  return new Date(Date.UTC(+y - 543, +mo - 1, +d, +h, +min, +sec)).toISOString()
}

function normalizeHeader(s) {
  return String(s || '').trim().toLowerCase().replace(/[\s_\-]/g, '')
}

function col(cols, headers, names, fallbackIndex) {
  for (const name of names) {
    const idx = headers.indexOf(normalizeHeader(name))
    if (idx >= 0) return cols[idx]
  }
  return fallbackIndex === undefined ? undefined : cols[fallbackIndex]
}

function parseRow(cols, headers) {
  const register = parseThaiDT(col(cols, headers, ['lvstdatetime'], undefined))
  const spcm = parseThaiDT(col(cols, headers, ['spcmdatetime', 'spcmdatee'], 8))
  const rslt = parseThaiDT(col(cols, headers, ['rsltdatetime', 'rsltdatee'], 9))
  if (!spcm || !rslt) return null
  const tat = (new Date(rslt) - new Date(spcm)) / 60000
  if (tat < 0 || tat > 10080) return null
  const spcmDate = new Date(spcm)
  return {
    hn: normalizeHn(col(cols, headers, ['hn'], 3)?.trim() || ''),
    ln: col(cols, headers, ['ln'], 5)?.trim() || '',
    register_at: register,
    spcm_at: spcm,
    rslt_at: rslt,
    tat_minutes: Math.round(tat * 10) / 10,
    lab_section: col(cols, headers, ['labsection', 'section'], 2)?.trim() || '',
    name_1: col(cols, headers, ['name1', 'name_1'], undefined)?.trim() || '',
    ward: col(cols, headers, ['ward'], 14)?.trim() || '',
    priority: col(cols, headers, ['priority'], 15)?.trim() || '',
    test_name: col(cols, headers, ['testname', 'test_name'], 13)?.trim() || '',
    spcm_hour: spcmDate.getUTCHours(),
    spcm_dow: spcmDate.getUTCDay(),
  }
}
