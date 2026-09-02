import Image from 'next/image'
import { type Lang } from '../../data'
import type { CollectionFigure } from '../collection-data'

interface SourceFigureProps {
  figure: CollectionFigure
  lang: Lang
  compact?: boolean
  ratio?: string
}

export function SourceFigure({ figure, lang, compact = false, ratio }: SourceFigureProps) {
  return (
    <figure style={{
      margin: 0,
      minWidth: 0,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--card)',
      boxShadow: compact ? 'none' : '0 5px 18px rgba(15,23,42,.07)',
    }}>
      <div style={{
        position: 'relative',
        aspectRatio: ratio ?? figure.ratio ?? (compact ? '4 / 3' : '16 / 10'),
        background: '#f8fafc',
      }}>
        <Image
          src={figure.src}
          alt={lang === 'th' ? figure.titleTh : figure.titleEn}
          fill
          sizes={compact ? '88px' : '(max-width: 640px) 100vw, 360px'}
          style={{ objectFit: 'contain', padding: compact ? 5 : 10 }}
        />
      </div>
      <figcaption style={{ padding: compact ? '7px 9px 9px' : '10px 12px 12px' }}>
        <div style={{ fontSize: compact ? 10.5 : 12.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.45 }}>
          {lang === 'th' ? figure.titleTh : figure.titleEn}
        </div>
        {!compact && (
          <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.55 }}>
            {lang === 'th' ? figure.captionTh : figure.captionEn}
          </div>
        )}
      </figcaption>
    </figure>
  )
}

export function SourceFigureGallery({ figures, lang, columns = 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }: {
  figures: CollectionFigure[]
  lang: Lang
  columns?: string
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 10 }}>
      {figures.map(figure => <SourceFigure key={figure.id} figure={figure} lang={lang} />)}
    </div>
  )
}

export function DetailRows({ items, lang, accent = 'var(--primary)' }: {
  items: { labelTh: string; labelEn: string; bodyTh: string; bodyEn: string }[]
  lang: Lang
  accent?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((item, index) => (
        <div key={`${item.labelEn}-${index}`} style={{
          display: 'grid', gridTemplateColumns: 'minmax(105px, 24%) minmax(0, 1fr)', gap: 12,
          padding: '10px 12px', border: '1px solid var(--border)', borderLeft: `3px solid ${accent}`,
          borderRadius: 9, background: index % 2 === 0 ? 'var(--card)' : 'var(--bg)',
        }}>
          <strong style={{ fontSize: 12, color: accent, lineHeight: 1.55 }}>
            {lang === 'th' ? item.labelTh : item.labelEn}
          </strong>
          <span style={{ minWidth: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
            {lang === 'th' ? item.bodyTh : item.bodyEn}
          </span>
        </div>
      ))}
    </div>
  )
}
