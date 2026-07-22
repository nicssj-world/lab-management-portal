'use client'

import { Fragment, useId, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ViewTabs } from '@/components/ui/ViewTabs'
import type { ViewNavigationItem } from '@/lib/navigation'
import {
  MATRIX_BANDS, MATRIX_COLS, MATRIX_ROWS, MATRIX_VIEW_LABELS, MOVEMENT_META,
  assessedCount, cellCenterPercent, cellsFor, flowStrokeWidth, movementFlows,
  movementOf, movementSummary, pointFor, scoreOf,
  type MatrixRisk, type MatrixView, type Movement,
} from '@/lib/risk/matrix'

interface RiskMatrixProps {
  risks: MatrixRisk[]
  view: MatrixView
  /** เจาะลงรายการในช่องนั้น — ไม่ส่งมา ช่องจะเป็นข้อความอย่างเดียว */
  onSelectCell?: (likelihood: number, impact: number) => void
}

const VIEW_TABS: readonly ViewNavigationItem<MatrixView>[] = [
  { id: 'inherent', label: MATRIX_VIEW_LABELS.inherent, icon: 'chart' },
  { id: 'residual', label: MATRIX_VIEW_LABELS.residual, icon: 'shieldCheck' },
  { id: 'movement', label: MATRIX_VIEW_LABELS.movement, icon: 'trending' },
]

const MOVEMENT_ORDER: Movement[] = ['improved', 'unchanged', 'worsened', 'unassessed']

/**
 * ตารางความเสี่ยง โอกาสเกิด × ผลกระทบ
 *
 * นอกจากดูการกระจายตัวก่อนและหลังมาตรการแล้ว ยังมีมุมมอง "การเคลื่อน" ที่ลากเส้น
 * จากตำแหน่งก่อนไปตำแหน่งหลัง ซึ่งเป็นสิ่งเดียวที่ตอบได้ว่ามาตรการได้ผลจริงไหม —
 * ตาราง 2 ใบวางคู่กันบังคับให้ผู้อ่านจำตำแหน่งไปเทียบเอง
 *
 * เส้นถูกรวมตามคู่ช่อง ไม่ใช่หนึ่งเส้นต่อหนึ่งความเสี่ยง จำนวนเส้นจึงโตตามจำนวน
 * เส้นทางที่ต่างกันแทนที่จะโตตามขนาดทะเบียน — ทะเบียน 150 รายการยังอ่านได้อยู่
 *
 * ช่องบอกจำนวนเป็นตัวเลข (ยกเว้นมุมมองการเคลื่อนที่สารคือเส้น) ช่องที่กดได้เป็น
 * <button> จริง และมีปุ่มสลับดูเป็นตาราง เพื่อให้อ่านได้เมื่อพิมพ์ขาวดำหรือใช้โปรแกรมอ่านหน้าจอ
 */
export function RiskMatrix({ risks, view, onSelectCell }: RiskMatrixProps) {
  const [asTable, setAsTable] = useState(false)
  const captionId = useId()

  const isMovement = view === 'movement'
  const gridView = isMovement ? 'residual' : view
  const cells = cellsFor(risks, gridView)
  const flows = isMovement ? movementFlows(risks) : []
  const summary = movementSummary(risks)
  const assessed = assessedCount(risks)

  const plotted = cells.reduce((total, cell) => total + cell.risks.length, 0)
  const caption = isMovement
    ? `การเคลื่อนของความเสี่ยง ${flows.length} เส้นทาง จาก ${assessed} รายการที่ประเมินครบทั้งก่อนและหลังมาตรการ`
    : `ตารางความเสี่ยง${MATRIX_VIEW_LABELS[view]} ${plotted} รายการ`

  return (
    <div>
      <style>{`
        /* ซอยเป็น grid ซ้อนชั้น: มุม / หัวคอลัมน์ / ป้ายแถว / พื้นที่ข้อมูล
           เพื่อให้ชั้นเส้นทาบพื้นที่ข้อมูลพอดีด้วย inset:0 โดยไม่ต้องวัดขนาดเอง
           วิธีเดิมใช้ grid-row:2/-1 บน grid ที่ไม่ได้ประกาศ grid-template-rows ไว้
           เส้น -1 จึงชี้ไปท้าย explicit grid (= เส้นที่ 1) กลายเป็นยึดแถวหัวตารางแล้วดันทุกช่องเลื่อน */
        .risk-matrix-frame{display:grid;grid-template-columns:34px minmax(0,1fr);gap:3px}
        .risk-matrix-colhead{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;padding-bottom:4px}
        .risk-matrix-rowhead{display:grid;grid-template-rows:repeat(5,minmax(44px,1fr));gap:3px}
        .risk-matrix-data{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));grid-template-rows:repeat(5,minmax(44px,1fr));gap:3px}
        .risk-matrix-axis{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--muted)}
        .risk-matrix-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:44px;padding:6px 4px;border:1px solid var(--border);border-radius:8px;font:inherit;line-height:1.2;text-align:center}
        .risk-matrix-cell[data-clickable="true"]{cursor:pointer;transition:box-shadow .15s ease,border-color .15s ease}
        .risk-matrix-cell[data-clickable="true"]:hover{border-color:var(--ink)}
        .risk-matrix-cell:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .risk-matrix-arrows{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
        .risk-matrix-toggle{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:color .15s ease,border-color .15s ease}
        .risk-matrix-toggle:hover{color:var(--ink);border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .risk-matrix-toggle:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        @media(prefers-reduced-motion:reduce){.risk-matrix-cell,.risk-matrix-toggle{transition:none}}
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <ViewTabs items={VIEW_TABS} value={view} param="matrix" label="มุมมองตารางความเสี่ยง" compact />
        <button type="button" className="risk-matrix-toggle" aria-pressed={asTable} onClick={() => setAsTable(v => !v)}>
          <Icon name={asTable ? 'chart' : 'clipboard'} size={14} />
          {asTable ? 'ดูเป็นตารางสี' : 'ดูเป็นตาราง'}
        </button>
      </div>

      <p id={captionId} style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        แนวตั้ง = ผลกระทบ (Impact) 1–5 · แนวนอน = โอกาสเกิด (Likelihood) 1–5 · ไม่รวมรายการที่ปิดแล้ว
      </p>

      {asTable
        ? <MatrixTable risks={risks} view={view} caption={caption} />
        : (
          <div className="risk-matrix-frame" role="group" aria-describedby={captionId} aria-label={caption}>
            <div />
            <div className="risk-matrix-colhead" aria-hidden="true">
              {MATRIX_COLS.map(c => <span key={c} className="risk-matrix-axis">{c}</span>)}
            </div>

            <div className="risk-matrix-rowhead" aria-hidden="true">
              {MATRIX_ROWS.map(r => <span key={r} className="risk-matrix-axis">{r}</span>)}
            </div>

            <div className="risk-matrix-data">
              {MATRIX_ROWS.map(impact => (
                <Fragment key={impact}>
                  {MATRIX_COLS.map(likelihood => {
                    const cell = cells.find(c => c.likelihood === likelihood && c.impact === impact)!
                    return (
                      <MatrixCellView
                        key={`${likelihood}-${impact}`}
                        cell={cell}
                        // ในมุมมองการเคลื่อน ช่องหนึ่งเป็นได้ทั้งต้นทางและปลายทาง การเจาะลงจึงกำกวม
                        onSelect={isMovement ? undefined : onSelectCell}
                        // ซ่อนจำนวนตอนดูการเคลื่อน ไม่งั้นตัวเลขในช่องถูกอ่านผิดเป็นจำนวนเส้น
                        // และหมุดปลายเส้นก็ทับตัวเลขจนอ่านไม่ออกอยู่ดี
                        showCount={!isMovement}
                      />
                    )
                  })}
                </Fragment>
              ))}

              {isMovement && flows.length > 0 && (
                <svg className="risk-matrix-arrows" aria-hidden="true">
                  {flows.map(flow => {
                    const from = cellCenterPercent(flow.from)
                    const to = cellCenterPercent(flow.to)
                    const tone = MOVEMENT_META[flow.movement].token
                    const key = `${flow.from.likelihood},${flow.from.impact}>${flow.to.likelihood},${flow.to.impact}`

                    // อยู่ช่องเดิม ไม่มีระยะให้ลาก — วงแหวนบอกว่ามีของค้างอยู่ตรงนี้
                    if (flow.inPlace) {
                      return (
                        <g key={key}>
                          <circle cx={`${to.x}%`} cy={`${to.y}%`} r={9} fill="none" stroke={tone} strokeWidth={2} />
                          <text
                            x={`${to.x}%`} y={`${to.y}%`} dy="0.35em" textAnchor="middle"
                            fill={tone} fontSize={10} fontWeight={700}
                          >
                            {flow.count}
                          </text>
                        </g>
                      )
                    }

                    return (
                      <g key={key}>
                        <line
                          x1={`${from.x}%`} y1={`${from.y}%`}
                          x2={`${to.x}%`} y2={`${to.y}%`}
                          stroke={tone} strokeWidth={flowStrokeWidth(flow.count)}
                          strokeLinecap="round" opacity={0.75}
                        />
                        {/* วงกลมกลวง = จุดตั้งต้น · วงกลมทึบ = จุดปลาย
                            รูปทรงต่างกันเป็นช่องทางที่สองนอกจากสี */}
                        <circle cx={`${from.x}%`} cy={`${from.y}%`} r={4} fill="var(--card)" stroke={tone} strokeWidth={2} />
                        <circle cx={`${to.x}%`} cy={`${to.y}%`} r={5} fill={tone} stroke="var(--card)" strokeWidth={1.5} />
                        {flow.count > 1 && (
                          <>
                            {/* กล่องขาวรองเลขไว้ ไม่ให้เส้นอื่นตัดผ่านจนอ่านไม่ออก */}
                            <circle cx={`${(from.x + to.x) / 2}%`} cy={`${(from.y + to.y) / 2}%`} r={8} fill="var(--card)" stroke={tone} strokeWidth={1} />
                            <text
                              x={`${(from.x + to.x) / 2}%`} y={`${(from.y + to.y) / 2}%`} dy="0.35em" textAnchor="middle"
                              fill={tone} fontSize={10} fontWeight={700}
                            >
                              {flow.count}
                            </text>
                          </>
                        )}
                      </g>
                    )
                  })}
                </svg>
              )}
            </div>
          </div>
        )}

      {isMovement && (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          แสดง {flows.length} เส้นทาง จาก {assessed} รายการที่ประเมินครบ
          {summary.unassessed > 0 && ` · อีก ${summary.unassessed} รายการยังไม่ได้ประเมินความเสี่ยงคงเหลือ จึงยังไม่มีเส้น`}
          {flows.some(f => f.count > 1) && ' · ตัวเลขบนเส้นคือจำนวนรายการที่เดินเส้นทางเดียวกัน'}
        </p>
      )}

      {isMovement && (
        <ul style={{ display: 'flex', gap: 14, flexWrap: 'wrap', listStyle: 'none', margin: '8px 0 0', padding: 0, fontSize: 12, color: 'var(--muted)' }}>
          {MOVEMENT_ORDER.map(key => (
            <li key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: MOVEMENT_META[key].token, display: 'inline-block' }} />
              {MOVEMENT_META[key].label}
              <strong style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{summary[key]}</strong>
            </li>
          ))}
        </ul>
      )}

      {!isMovement && (
        <ul style={{ display: 'flex', gap: 12, flexWrap: 'wrap', listStyle: 'none', margin: '10px 0 0', padding: 0, fontSize: 11, color: 'var(--muted)' }}>
          {MATRIX_BANDS.map(band => (
            <li key={band.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: `color-mix(in srgb, ${band.token} 30%, var(--card))`, border: `1px solid ${band.token}`, display: 'inline-block' }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{band.min}–{band.max}</span> {band.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MatrixCellView({ cell, onSelect, showCount = true }: {
  cell: ReturnType<typeof cellsFor>[number]
  onSelect?: (likelihood: number, impact: number) => void
  showCount?: boolean
}) {
  const count = cell.risks.length
  const clickable = count > 0 && Boolean(onSelect)
  const label = `โอกาสเกิด ${cell.likelihood} ผลกระทบ ${cell.impact} · คะแนน ${cell.score} · ระดับ${cell.band.label} · ${count === 0 ? 'ไม่มีรายการ' : `${count} รายการ`}`

  const style = {
    background: `color-mix(in srgb, ${cell.band.token} 14%, var(--card))`,
    color: count > 0 ? cell.band.token : 'var(--muted)',
  }

  // ในมุมมองการเคลื่อน กึ่งกลางช่องต้องว่างไว้ให้ปลายเส้นและวงแหวน — ถ้าปล่อยให้คะแนน
  // เป็นลูกเดียวใน flex column มันจะเลื่อนไปกึ่งกลางตาม justify-content:center ของ .risk-matrix-cell
  // ทับกับหมุดพอดี จึงตรึงไว้มุมบนซ้ายแทนเมื่อไม่แสดงจำนวน
  const content = showCount ? (
    <>
      <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cell.score}</span>
      <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count === 0 ? '—' : count}</span>
    </>
  ) : (
    <span
      aria-hidden="true"
      style={{ position: 'absolute', top: 3, left: 5, fontSize: 9, fontWeight: 700, fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}
    >
      {cell.score}
    </span>
  )

  const cellStyle: React.CSSProperties = { ...style, position: 'relative' }

  if (!clickable) {
    return <div className="risk-matrix-cell" style={cellStyle} role="img" aria-label={label}>{content}</div>
  }

  return (
    <button
      type="button"
      className="risk-matrix-cell"
      data-clickable="true"
      style={cellStyle}
      aria-label={`${label} — ดูรายการ`}
      onClick={() => onSelect?.(cell.likelihood, cell.impact)}
    >
      {content}
    </button>
  )
}

/** ทางเลือกที่อ่านได้โดยไม่พึ่งสีและตำแหน่ง สำหรับพิมพ์ขาวดำและโปรแกรมอ่านหน้าจอ */
function MatrixTable({ risks, view, caption }: { risks: MatrixRisk[]; view: MatrixView; caption: string }) {
  const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }
  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }
  const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }

  if (view === 'movement') {
    const rows = risks.filter(r => pointFor(r, 'inherent') || pointFor(r, 'residual'))
    return (
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 520 }}>
          <caption style={srOnly}>{caption}</caption>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['รหัส', 'ก่อนมาตรการ', 'หลังมาตรการ', 'ทิศทาง'].map(h => <th key={h} scope="col" style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(risk => {
              const before = pointFor(risk, 'inherent')
              const after = pointFor(risk, 'residual')
              const move = movementOf(risk)
              return (
                <tr key={risk.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{risk.id}</td>
                  <td style={td}>{before ? `${before.likelihood}×${before.impact} = ${scoreOf(before)}` : '—'}</td>
                  <td style={td}>{after ? `${after.likelihood}×${after.impact} = ${scoreOf(after)}` : '—'}</td>
                  <td style={{ ...td, color: MOVEMENT_META[move].token, fontWeight: 700 }}>{MOVEMENT_META[move].label}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>ยังไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  const filled = cellsFor(risks, view).filter(cell => cell.risks.length > 0)
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 460 }}>
        <caption style={srOnly}>{caption}</caption>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            {['โอกาสเกิด', 'ผลกระทบ', 'คะแนน', 'ระดับ', 'จำนวน', 'รายการ'].map(h => <th key={h} scope="col" style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {filled.map(cell => (
            <tr key={`${cell.likelihood}-${cell.impact}`} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={td}>{cell.likelihood}</td>
              <td style={td}>{cell.impact}</td>
              <td style={td}>{cell.score}</td>
              <td style={{ ...td, color: cell.band.token, fontWeight: 700 }}>{cell.band.label}</td>
              <td style={td}>{cell.risks.length}</td>
              <td style={{ ...td, color: 'var(--muted)' }}>{cell.risks.map(r => r.id).join(', ')}</td>
            </tr>
          ))}
          {filled.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>ยังไม่มีข้อมูล</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
