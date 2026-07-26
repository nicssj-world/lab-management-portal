import type { GhsPictogramCode } from '@/lib/chemical-safety/types'

const LABELS: Record<GhsPictogramCode, { th: string; en: string }> = {
  GHS01: { th: 'วัตถุระเบิด', en: 'Explosive' }, GHS02: { th: 'ไวไฟ', en: 'Flammable' },
  GHS03: { th: 'สารออกซิไดซ์', en: 'Oxidizer' }, GHS04: { th: 'ก๊าซภายใต้ความดัน', en: 'Gas under pressure' },
  GHS05: { th: 'กัดกร่อน', en: 'Corrosive' }, GHS06: { th: 'พิษเฉียบพลัน', en: 'Acute toxicity' },
  GHS07: { th: 'ระคายเคือง/เป็นอันตราย', en: 'Irritant or harmful' }, GHS08: { th: 'อันตรายต่อสุขภาพร้ายแรง', en: 'Serious health hazard' },
  GHS09: { th: 'อันตรายต่อสิ่งแวดล้อม', en: 'Environmental hazard' },
}

export function GhsPictogram({ code, size = 46 }: { code: GhsPictogramCode; size?: number }) {
  const label = LABELS[code]
  return <span title={`${code} — ${label.th} / ${label.en}`} aria-label={`${code} ${label.th} ${label.en}`} style={{ display: 'inline-grid', placeItems: 'center', gap: 2 }}>
    <img src={`/ghs/${code}.svg`} alt={`${code} ${label.th} / ${label.en}`} width={size} height={size} />
    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em' }}>{code}</span>
  </span>
}
