import type { ReactNode } from 'react'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  published: { label: 'เผยแพร่แล้ว', color: 'green' },
  open: { label: 'เปิดรับคำตอบ', color: 'green' },
  scheduled: { label: 'รอเปิด', color: 'blue' },
  expired_pending_close: { label: 'หมดเวลารอปิดรอบ', color: 'amber' },
  draft: { label: 'ฉบับร่าง', color: 'amber' },
  closed: { label: 'ปิดแล้ว', color: 'gray' },
  archived: { label: 'เก็บถาวร', color: 'gray' },
}

export function SatisfactionStatusBadge({ status }: { status: string | null }) {
  const item = STATUS[status ?? ''] ?? { label: status || 'ไม่ระบุสถานะ', color: 'gray' as const }
  return <Badge color={item.color} dot>{item.label}</Badge>
}

export function SatisfactionSectionHeading({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return <div className="satisfaction-section-heading"><div><h2>{title}</h2><p>{hint}</p></div>{action}</div>
}

export function SatisfactionSummaryCard({ label, value, hint, icon, tone }: { label: string; value: string | number; hint: string; icon: string; tone: 'teal' | 'blue' | 'purple' }) {
  return <Card className={`satisfaction-summary-card satisfaction-summary-card-${tone}`}><span className="satisfaction-summary-icon"><Icon name={icon} size={19} /></span><div className="satisfaction-summary-copy"><div className="satisfaction-summary-label">{label}</div><div className="satisfaction-summary-value">{value}</div><div className="satisfaction-summary-hint">{hint}</div></div></Card>
}

export function SatisfactionLoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  return <div className="satisfaction-loading" aria-live="polite" aria-label={label}>{Array.from({ length: rows }, (_, index) => <span key={index} className="satisfaction-skeleton-row" />)}<span className="satisfaction-loading-label"><Spinner />{label}</span></div>
}

export function SatisfactionInlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="satisfaction-inline-error" role="alert"><span>{message}</span>{onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>ลองใหม่</Button>}</div>
}
