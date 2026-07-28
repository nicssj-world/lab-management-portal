import type { SafetyInspectionQueue } from '@/lib/lab-map/types'

export function SafetyInspectionProgress({ queue, roundName, canStart, canClose, busy, onStart, onClose }: {
  queue: SafetyInspectionQueue
  roundName?: string | null
  canStart?: boolean
  canClose?: boolean
  busy?: boolean
  onStart?: () => void
  onClose?: () => void
}) {
  return <section className="safety-inspection-progress" aria-label="ความคืบหน้าการตรวจ">
    <div>
      <strong>{roundName || 'การตรวจอุปกรณ์'}</strong>
      <span>ตรวจแล้ว {queue.progress.completed}/{queue.progress.total} · เหลือ {queue.progress.remaining}</span>
    </div>
    <progress value={queue.progress.completed} max={Math.max(queue.progress.total, 1)}>
      {queue.progress.completed} จาก {queue.progress.total}
    </progress>
    {canStart && onStart ? <button type="button" disabled={busy || queue.progress.total === 0} onClick={onStart}>เริ่มรอบตรวจใหม่</button> : null}
    {canClose && onClose ? <button type="button" disabled={busy} onClick={onClose}>ปิดรอบตรวจ</button> : null}
  </section>
}
