'use client'

import { Fragment } from 'react'

interface Risk {
  id: string
  name: string
  likelihood: number
  impact: number
  level: string
  status: string
}

interface RiskHeatmapProps {
  risks: Risk[]
}

function cellColor(score: number) {
  if (score >= 15) return '#FEE2E2'
  if (score >= 8)  return '#FEF3C7'
  if (score >= 4)  return '#D1FAE5'
  return '#F1F5F9'
}
function textColor(score: number) {
  if (score >= 15) return '#B91C1C'
  if (score >= 8)  return '#B45309'
  if (score >= 4)  return '#15803D'
  return '#64748B'
}

export function RiskHeatmap({ risks }: RiskHeatmapProps) {
  const COLS = [1, 2, 3, 4, 5]
  const ROWS = [5, 4, 3, 2, 1]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(5, 1fr)', gap: 3 }}>
        {/* Header row */}
        <div />
        {COLS.map(c => (
          <div key={c} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, paddingBottom: 4 }}>
            {c}
          </div>
        ))}
        {/* Grid rows */}
        {ROWS.map(impact => (
          <Fragment key={impact}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
              {impact}
            </div>
            {COLS.map(likelihood => {
              const score = likelihood * impact
              const cell = risks.filter(r => r.likelihood === likelihood && r.impact === impact)
              return (
                <div
                  key={`${likelihood}-${impact}`}
                  title={cell.map(r => r.name).join(', ') || undefined}
                  style={{
                    background: cellColor(score), borderRadius: 8,
                    padding: '6px 4px', minHeight: 44, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, border: '1px solid rgba(0,0,0,.05)',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: textColor(score) }}>
                    {score}
                  </div>
                  {cell.length > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: textColor(score), textAlign: 'center', lineHeight: 1.2 }}>
                      {cell.length > 1 ? `${cell.length}x` : cell[0].id}
                    </div>
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FEE2E2', border: '1px solid rgba(0,0,0,.08)', display: 'inline-block' }} />
          สูง (≥15)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FEF3C7', border: '1px solid rgba(0,0,0,.08)', display: 'inline-block' }} />
          ปานกลาง (≥8)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#D1FAE5', border: '1px solid rgba(0,0,0,.08)', display: 'inline-block' }} />
          ต่ำ (≥4)
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
        แกน X = โอกาสเกิด · แกน Y = ผลกระทบ
      </div>
    </div>
  )
}
