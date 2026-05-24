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

function parseThaiDT(s) {
  if (!s) return null
  const m = s.trim().match(/(\d+)\/(\d+)\/(\d+) - (\d+):(\d+):(\d+)/)
  if (!m) return null
  const [, d, mo, y, h, min, sec] = m
  // Buddhist Era year → CE year
  return new Date(Date.UTC(+y - 543, +mo - 1, +d, +h, +min, +sec)).toISOString()
}

function parseRow(cols) {
  const spcm = parseThaiDT(cols[8])
  const rslt = parseThaiDT(cols[9])
  if (!spcm || !rslt) return null
  const tat = (new Date(rslt) - new Date(spcm)) / 60000
  if (tat < 0 || tat > 10080) return null
  const spcmDate = new Date(spcm)
  return {
    hn: cols[3]?.trim() || '',
    spcm_at: spcm,
    rslt_at: rslt,
    tat_minutes: Math.round(tat * 10) / 10,
    lab_section: cols[2]?.trim() || '',
    ward: cols[14]?.trim() || '',
    priority: cols[15]?.trim() || '',
    test_name: cols[13]?.trim() || '',
    spcm_hour: spcmDate.getUTCHours(),
    spcm_dow: spcmDate.getUTCDay(),
  }
}
