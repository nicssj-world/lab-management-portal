'use client'

import { useMemo, useState } from 'react'

type Person = { id: string; name: string }
type ProgramTest = Record<string, any>
type ResultRow = Record<string, any>
type Outcome = '' | 'acceptable' | 'unacceptable'
type CapaDraft = { title: string; rootCause: string; correctiveAction: string; ownerId: string; dueOn: string }
type RowState = { outcome: Outcome; capa: CapaDraft }

const emptyCapa = (): CapaDraft => ({ title: '', rootCause: '', correctiveAction: '', ownerId: '', dueOn: '' })
const input = { minHeight: 34, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 9px', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12.5 }
const button = { minHeight: 34, border: 0, borderRadius: 8, padding: '0 14px', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

async function request(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(payload?.error ? `${payload.error}${payload.blockers?.length ? `: ${payload.blockers.join(', ')}` : ''}` : 'บันทึกไม่สำเร็จ')
  return payload
}

export function RoundResultEntry({
  roundId, canRecord, programTests, existingResults, capaResultIds, responsiblePeople, today, onError, refresh,
}: {
  roundId: string
  canRecord: boolean
  programTests: ProgramTest[]
  existingResults: ResultRow[]
  capaResultIds: Set<string>
  responsiblePeople: Person[]
  today: string
  onError: (message: string) => void
  refresh: () => void
}) {
  const resultByTest = useMemo(() => new Map(existingResults.map(result => [result.program_test_id, result])), [existingResults])
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {}
    for (const test of programTests) {
      const existing = resultByTest.get(test.id)
      const outcome: Outcome = existing?.outcome === 'acceptable' || existing?.outcome === 'unacceptable' ? existing.outcome : ''
      initial[test.id] = { outcome, capa: emptyCapa() }
    }
    return initial
  })
  const [busy, setBusy] = useState(false)

  const setOutcome = (testId: string, outcome: Outcome) => setRows(current => ({ ...current, [testId]: { ...current[testId], outcome } }))
  const setCapa = (testId: string, patch: Partial<CapaDraft>) => setRows(current => ({ ...current, [testId]: { ...current[testId], capa: { ...current[testId].capa, ...patch } } }))
  const hasCapa = (testId: string) => { const existing = resultByTest.get(testId); return existing ? capaResultIds.has(existing.id) : false }

  async function save() {
    onError('')
    const selected = programTests.filter(test => rows[test.id]?.outcome === 'acceptable' || rows[test.id]?.outcome === 'unacceptable')
    if (selected.length === 0) { onError('เลือกผ่าน/ไม่ผ่านอย่างน้อยหนึ่งรายการก่อนบันทึก'); return }
    const needCapa = selected.filter(test => rows[test.id].outcome === 'unacceptable' && !hasCapa(test.id))
    for (const test of needCapa) {
      const capa = rows[test.id].capa
      if (!capa.title.trim() || !capa.rootCause.trim() || !capa.correctiveAction.trim() || !capa.ownerId) {
        onError(`กรุณากรอก CAPA ให้ครบสำหรับรายการที่ไม่ผ่าน: ${test.test_name_snapshot}`)
        return
      }
    }
    setBusy(true)
    try {
      const results = selected.map(test => ({
        programTestId: test.id, outcome: rows[test.id].outcome,
        sampleCode: null, reportedValue: null, targetValue: null, zScore: null, sdi: null, score: null, reason: null, note: null,
      }))
      const saved = await request(`/api/admin/eqa/rounds/${roundId}/results`, 'PUT', { results })
      const savedIdByTest = new Map<string, string>((saved?.results ?? []).map((row: ResultRow) => [row.program_test_id, row.id]))
      for (const test of needCapa) {
        const resultId = savedIdByTest.get(test.id)
        if (!resultId) throw new Error(`ไม่พบผลที่บันทึกของ ${test.test_name_snapshot} เพื่อผูก CAPA`)
        const capa = rows[test.id].capa
        await request('/api/admin/eqa/capas', 'POST', {
          roundId, resultIds: [resultId], title: capa.title.trim(), rootCause: capa.rootCause.trim(),
          immediateCorrection: null, correctiveAction: capa.correctiveAction.trim(), ownerId: capa.ownerId, dueOn: capa.dueOn || today,
        })
      }
      refresh()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  if (programTests.length === 0) return <span style={{ color: 'var(--muted)', fontSize: 12 }}>ยังไม่มีรายการตรวจในโครงการนี้</span>
  if (!canRecord) return <span style={{ color: '#B45309', fontSize: 12 }}>บันทึกรับตัวอย่าง/ส่งผลก่อน จึงจะกรอกผลได้</span>

  return <div style={{ display: 'grid', gap: 8, minWidth: 300 }}>
    {programTests.map(test => {
      const state = rows[test.id]
      const locked = hasCapa(test.id)
      return <div key={test.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5 }}>{test.test_name_snapshot}</div>
        {test.equipment_name_snapshot && <div style={{ color: 'var(--muted)', fontSize: 11 }}>เครื่อง: {test.equipment_name_snapshot}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {(['acceptable', 'unacceptable'] as const).map(value => <button
            key={value} type="button"
            onClick={() => setOutcome(test.id, state.outcome === value ? '' : value)}
            style={{ ...button, minHeight: 30, fontSize: 11.5, background: state.outcome === value ? (value === 'acceptable' ? '#15803D' : '#B91C1C') : 'var(--surface-2)', color: state.outcome === value ? '#fff' : 'var(--ink)' }}
          >{value === 'acceptable' ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}</button>)}
        </div>
        {state.outcome === 'unacceptable' && (locked
          ? <div style={{ marginTop: 6, fontSize: 11, color: '#15803D' }}>มี CAPA แล้ว (แก้ไขได้ที่แท็บ CAPA)</div>
          : <div style={{ display: 'grid', gap: 5, marginTop: 6 }}>
              <input style={input} placeholder="เรื่อง CAPA" value={state.capa.title} onChange={event => setCapa(test.id, { title: event.target.value })} />
              <input style={input} placeholder="สาเหตุราก" value={state.capa.rootCause} onChange={event => setCapa(test.id, { rootCause: event.target.value })} />
              <input style={input} placeholder="การแก้ไขป้องกัน" value={state.capa.correctiveAction} onChange={event => setCapa(test.id, { correctiveAction: event.target.value })} />
              <select style={input} value={state.capa.ownerId} onChange={event => setCapa(test.id, { ownerId: event.target.value })}>
                <option value="">ผู้รับผิดชอบ</option>
                {responsiblePeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <input style={input} type="date" value={state.capa.dueOn || today} onChange={event => setCapa(test.id, { dueOn: event.target.value })} />
            </div>)}
      </div>
    })}
    <button type="button" style={button} disabled={busy} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกผลรอบนี้'}</button>
  </div>
}
