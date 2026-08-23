import type { SafetyInspectionQueue } from '@/lib/lab-map/types'

export type SafetyInspectionRoundKindOption = {
  kind: string
  label: string
  completed: number
  total: number
  closed: boolean
}

export function SafetyInspectionProgress({ queue, roundName, roundKinds, selectedRoundKind, roundKindLabel, loading, canStart, canClose, busy, startHint, onStart, onClose, onRoundKindChange }: {
  queue: SafetyInspectionQueue
  roundName?: string | null
  roundKinds?: readonly SafetyInspectionRoundKindOption[]
  selectedRoundKind?: string
  roundKindLabel?: string | null
  loading?: boolean
  canStart?: boolean
  canClose?: boolean
  busy?: boolean
  startHint?: string
  onStart?: () => void
  onClose?: () => void
  onRoundKindChange?: (kind: string) => void
}) {
  return <section className="safety-inspection-progress" aria-label="ความคืบหน้าการตรวจ">
    <div>
      <strong>{roundName || 'การตรวจอุปกรณ์'}</strong>
      <span>{loading ? 'กำลังโหลดรายการของรอบตรวจ…' : `ตรวจแล้ว ${queue.progress.completed}/${queue.progress.total} · เหลือ ${queue.progress.remaining}`}</span>
    </div>
    {roundKinds?.length && onRoundKindChange ? <label className="safety-inspection-kind-selector">
      <span>ประเภทอุปกรณ์ในรอบนี้</span>
      <select value={selectedRoundKind ?? ''} disabled={loading || busy} onChange={event => onRoundKindChange(event.target.value)}>
        {roundKinds.map(option => <option key={option.kind} value={option.kind}>{option.label} · {option.completed}/{option.total}{option.closed ? ' · ปิดแล้ว' : ''}</option>)}
      </select>
    </label> : null}
    <progress value={loading ? 0 : queue.progress.completed} max={Math.max(queue.progress.total, 1)}>
      {queue.progress.completed} จาก {queue.progress.total}
    </progress>
    {loading ? <small>กำลังโหลดเฉพาะอุปกรณ์ของงานนี้ — ไม่รวมอุปกรณ์ประเภทอื่น</small> : null}
    {!loading && roundName && !canClose ? <small id="safety-inspection-close-hint">รอบ {roundKindLabel ? `“${roundKindLabel}” ` : ''}ยังเปิดอยู่ — ตรวจรายการให้ครบก่อนปิดรอบ</small> : null}
    {!roundName && startHint ? <small>{startHint}</small> : null}
    {canStart && onStart ? <button type="button" disabled={busy || loading || queue.progress.total === 0} onClick={onStart}>เริ่มรอบตรวจใหม่</button> : null}
    {!loading && roundName && onClose ? <button
      type="button"
      className="safety-inspection-close-action"
      disabled={Boolean(busy || !canClose)}
      aria-describedby={canClose ? undefined : 'safety-inspection-close-hint'}
      onClick={onClose}
    >ปิดรอบตรวจ{roundKindLabel ? ` — ${roundKindLabel}` : ''}</button> : null}
  </section>
}
