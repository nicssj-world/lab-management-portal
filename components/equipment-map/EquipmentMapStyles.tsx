/**
 * ส่วนเสริมเฉพาะแผนผังเครื่องมือ — โทเค็นสี/ผนัง/ห้อง ใช้ร่วมกับ <LabMapStyles /> (lib/lab-map)
 * ที่ห่ออยู่ใน .lab-map-shell เดียวกันเสมอ ไม่ประกาศค่าโทเค็นซ้ำที่นี่
 */
export function EquipmentMapStyles() {
  return (
    <style>{`
      .equipment-map-shell { --map-floor: #edf2f3; --pin-ok: #16a34a; --pin-due-soon: #d97706; --pin-overdue: #dc2626; --pin-unplanned: #64748b; --pin-not-required: #b8c2c8; }
      .equipment-map-shell .lab-map-workspace { align-items: start; height: auto; overflow: visible; }
      .equipment-mobile-walk-bar { display: none; }

      .equipment-map-toolbar { align-items: flex-end; background: #fff; border: 1px solid #dbe5e8; border-radius: 14px 14px 0 0; display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; padding: 12px 14px; }
      .equipment-map-search { align-items: center; background: var(--card); border: 1px solid var(--border); border-radius: 8px; display: flex; gap: 8px; min-height: 44px; min-width: 220px; padding: 0 12px; }
      .equipment-map-search input { background: transparent; border: 0; color: var(--ink); flex: 1 1 auto; font: inherit; font-size: .84rem; min-width: 0; outline: 0; }

      .equipment-map-space[data-dimmed] > rect, .equipment-map-space[data-dimmed] > polygon { opacity: .3; }
      /* ห้องที่ซอยเป็นโซนแล้ว วาดแค่กรอบ ไม่ระบายทับโซนลูก */
      .equipment-map-space[data-split-room] > rect, .equipment-map-space[data-split-room] > polygon { fill: none; }
      .equipment-map-door { fill: var(--map-floor); stroke: var(--map-line); stroke-width: 1.5; vector-effect: non-scaling-stroke; }

      .equipment-pin { cursor: pointer; outline: none; }
      .equipment-pin[data-draggable] { cursor: grab; }
      .equipment-pin[data-dragging] { cursor: grabbing; }
      .equipment-pin-hit-area { fill: transparent; pointer-events: all; }
      .equipment-pin-body { fill: #fff; stroke: var(--map-blue); stroke-width: 2.4; vector-effect: non-scaling-stroke; }
      .equipment-pin[data-surveyed="true"] .equipment-pin-body { stroke: var(--success); }
      .equipment-pin[data-surveyed="false"] .equipment-pin-body { stroke: var(--danger); }
      .equipment-pin[data-surveyed="none"] .equipment-pin-body { stroke: #94a3b8; }
      .equipment-pin[data-dimmed] { opacity: .3; }
      .equipment-pin[data-selected] .equipment-pin-body { stroke-width: 4.5; filter: drop-shadow(0 0 4px rgba(30,95,173,.55)); }
      .equipment-pin:focus-visible .equipment-pin-body { stroke: var(--map-blue); stroke-width: 5; }
      .equipment-pin-outline { fill: none; }
      .equipment-pin-detail { fill: none; stroke: var(--map-blue); stroke-linecap: round; stroke-width: 1.8; vector-effect: non-scaling-stroke; }
      .equipment-pin-rotor-dot { fill: var(--map-blue); }
      .equipment-pin-code { fill: var(--map-blue); font: 800 10px "DM Mono", monospace; pointer-events: none; text-anchor: middle; dominant-baseline: central; }
      .equipment-pin-badge-layer { pointer-events: none; }
      .equipment-pin-badge[data-dimmed] { opacity: .3; }
      .equipment-pin-status-badge circle { fill: #64748b; stroke: #fff; stroke-width: 1.8; vector-effect: non-scaling-stroke; }
      .equipment-pin-badge[data-due="due_soon"] .equipment-pin-status-badge circle { fill: var(--pin-due-soon); }
      .equipment-pin-badge[data-due="overdue"] .equipment-pin-status-badge circle { fill: var(--pin-overdue); }
      .equipment-pin-badge[data-due="unplanned"] .equipment-pin-status-badge circle { fill: var(--pin-unplanned); }
      .equipment-pin-badge[data-due="not_required"] .equipment-pin-status-badge circle { fill: var(--pin-not-required); }
      .equipment-pin-status-badge .equipment-pin-glyph { fill: #fff; font: 800 9px "Noto Sans Thai", sans-serif; pointer-events: none; text-anchor: middle; dominant-baseline: central; }
      /* Traces a badge back to its own pin when pins sit close together in a cluster. */
      .equipment-pin-status-leader { stroke: #64748b; stroke-width: 1.4; stroke-linecap: round; vector-effect: non-scaling-stroke; pointer-events: none; }
      .equipment-pin-badge[data-due="due_soon"] .equipment-pin-status-leader { stroke: var(--pin-due-soon); }
      .equipment-pin-badge[data-due="overdue"] .equipment-pin-status-leader { stroke: var(--pin-overdue); }
      .equipment-pin-badge[data-due="unplanned"] .equipment-pin-status-leader { stroke: var(--pin-unplanned); }
      .equipment-pin-badge[data-due="not_required"] .equipment-pin-status-leader { stroke: var(--pin-not-required); }

      .equipment-map-legend { align-items: center; background: var(--map-navy); color: #fff; display: flex; flex-wrap: wrap; gap: 16px; padding: 10px 16px; font-size: .74rem; }
      .equipment-map-legend span { align-items: center; display: flex; gap: 6px; }
      .equipment-map-legend i { border-radius: 50%; display: inline-block; height: 14px; width: 14px; border: 2px solid #fff; }
      .equipment-map-legend .equipment-map-legend-badge { align-items: center; border-width: 1.5px; display: inline-flex; font: 800 10px "Noto Sans Thai", sans-serif; font-style: normal; justify-content: center; line-height: 1; }
      .equipment-map-legend-badge--pending { background: var(--pin-unplanned); }
      .equipment-map-legend-badge--due-soon { background: var(--pin-due-soon); }
      .equipment-map-legend-badge--overdue { background: var(--pin-overdue); }
      .equipment-map-symbol-legend { align-items: center; background: var(--card); border: 1px solid var(--border); color: var(--ink); display: flex; flex-wrap: wrap; font-size: .72rem; gap: 12px 16px; padding: 9px 16px; }
      .equipment-map-symbol-legend span { align-items: center; display: flex; gap: 6px; }
      .equipment-symbol-swatch { align-items: center; background: #fff; border: 2px solid var(--map-blue); border-radius: 4px; color: var(--map-blue); display: inline-flex; font: 700 7px "DM Mono", monospace; height: 17px; justify-content: center; min-width: 25px; padding: 0 3px; }
      .equipment-symbol-preview { display: block; flex: 0 0 auto; overflow: visible; }
      .equipment-symbol-preview--refrigerator { height: 25px; width: 16px; }
      .equipment-symbol-preview--centrifuge { height: 20px; width: 24px; }
      .equipment-symbol-preview--microscope { height: 25px; width: 27px; }
      .equipment-symbol-preview--bsc { height: 20px; width: 34px; }
      .equipment-symbol-preview-body { fill: #fff; stroke: var(--map-blue); stroke-width: 2.4; vector-effect: non-scaling-stroke; }
      .equipment-symbol-preview-outline { fill: none; }
      .equipment-symbol-preview-detail { fill: none; stroke: var(--map-blue); stroke-linecap: round; stroke-width: 1.8; vector-effect: non-scaling-stroke; }
      .equipment-symbol-preview-dot { fill: var(--map-blue); }

      .equipment-area-panel { background: #fff; border-left: 1px solid #ccdadd; min-height: 0; min-width: 0; overflow-y: auto; padding: 22px 20px; }
      .equipment-area-panel h2 { color: var(--map-navy); font-size: 1.05rem; margin: 2px 0 4px; }
      .equipment-area-panel .equipment-area-kind { color: var(--map-blue); font-family: "DM Mono", monospace; font-size: .62rem; letter-spacing: .1em; margin: 0; text-transform: uppercase; }
      .equipment-area-counts { display: grid; gap: 8px; grid-template-columns: repeat(2, 1fr); margin: 16px 0; }
      .equipment-area-count-tile { background: var(--surface-2); border-radius: 8px; padding: 8px 10px; }
      .equipment-area-count-tile b { display: block; font-size: 1.05rem; }
      .equipment-area-count-tile span { color: var(--muted); font-size: .68rem; }
      .equipment-pin-row { align-items: center; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; gap: 8px; justify-content: space-between; min-height: 44px; padding: 8px 2px; }
      .equipment-pin-row:hover { background: var(--surface-2); }
      .equipment-pin-row-name { font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .equipment-pin-row-code { color: var(--muted); font-family: "DM Mono", monospace; font-size: .68rem; }

      .equipment-placement-item { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; padding: 10px 12px; }
      .equipment-placement-panel { box-sizing: border-box; overflow: visible; }
      .equipment-placement-content { margin-top: 12px; }
      .equipment-placement-list { overflow: visible; padding-bottom: 32px; }
      .equipment-placement-back { margin: 14px 0 16px; }
      .equipment-placement-toolbar { align-items: end; background: var(--card); border: 1px solid var(--border); border-top: 0; display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; padding: 12px 14px; }
      .equipment-placement-toolbar-title { display: grid; gap: 2px; min-width: 210px; }
      .equipment-placement-toolbar-title strong { color: var(--ink); font-size: .82rem; }
      .equipment-placement-toolbar-title span { color: var(--muted); font-size: .68rem; }
      .equipment-placement-toolbar-controls { align-items: end; display: flex; flex: 1 1 560px; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
      .equipment-placement-toolbar-controls label { flex: 1 1 190px; max-width: 260px; }
      .equipment-placement-toolbar-controls label > span { color: var(--muted); display: block; font-size: .68rem; font-weight: 600; margin: 0 0 4px 2px; }
      .equipment-placement-toolbar-controls select { background: var(--card); border: 1px solid var(--border); border-radius: 8px; color: var(--ink); font: inherit; font-size: .78rem; min-height: 44px; padding: 0 10px; width: 100%; }
      .equipment-placement-toolbar-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
      .equipment-placement-pagination { align-items: center; background: var(--surface-2); border-radius: 10px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; margin-bottom: 12px; padding: 9px 10px; }
      .equipment-placement-pagination > span { color: var(--muted); font-size: .72rem; }
      .equipment-placement-pagination > div { align-items: center; display: flex; gap: 6px; }
      .equipment-placement-pagination b { color: var(--ink); font-size: .7rem; min-width: 58px; text-align: center; }
      .equipment-placement-item h4 { font-size: .84rem; margin: 0 0 2px; }
      .equipment-placement-name { background: transparent; border: 0; color: var(--ink); cursor: pointer; font: inherit; font-weight: 650; padding: 0; text-align: left; text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 3px; }
      .equipment-placement-name:hover, .equipment-placement-name:focus-visible { color: var(--primary); text-decoration-color: currentColor; }
      .equipment-placement-name:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 2px; }
      .equipment-placement-item p { color: var(--muted); font-size: .72rem; margin: 0 0 8px; }
      .equipment-placement-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
      .equipment-placement-select { border: 1px solid var(--border); border-radius: 8px; font: inherit; font-size: .78rem; min-height: 40px; padding: 0 8px; }

      .equipment-survey-bar { align-items: center; background: #fff; border: 1px solid #dbe5e8; border-top: 0; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; padding: 10px 16px; }
      .equipment-survey-bar-info { color: var(--map-navy); font-size: .82rem; }

      @media (max-width: 767px) {
        .equipment-mobile-walk-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; display: grid; gap: 10px; margin: 12px 0; padding: 12px; }
        .equipment-mobile-walk-status { align-items: flex-start; display: flex; gap: 10px; justify-content: space-between; }
        .equipment-mobile-walk-status span { color: var(--muted); font-size: .72rem; }
        .equipment-mobile-walk-status strong { color: var(--map-navy); font-size: .78rem; text-align: right; }
        .equipment-mobile-walk-controls { align-items: end; display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) auto; }
        .equipment-mobile-walk-controls label { min-width: 0; }
        .equipment-mobile-walk-controls label > span { color: var(--muted); display: block; font-size: .7rem; font-weight: 650; margin: 0 0 4px 2px; }
        .equipment-mobile-walk-controls select { background: var(--card); border: 1px solid var(--border); border-radius: 8px; color: var(--ink); font: inherit; font-size: .8rem; min-height: 44px; padding: 0 10px; width: 100%; }
        .equipment-mobile-walk-controls > button { min-height: 44px; white-space: nowrap; }
        .equipment-mobile-walk-summary { border-top: 1px solid var(--border); color: var(--muted); display: grid; font-size: .74rem; gap: 2px; margin: 0; padding-top: 9px; }
        .equipment-mobile-walk-summary b { color: var(--ink); font-size: .8rem; }
        .equipment-placement-toolbar { align-items: stretch; }
        .equipment-placement-toolbar-controls { align-items: stretch; flex-basis: 100%; flex-direction: column; }
        .equipment-placement-toolbar-controls label { max-width: none; }
        .equipment-placement-toolbar-actions > button { flex: 1 1 auto; }
        .equipment-area-panel { border: 0; border-radius: 20px 20px 0 0; bottom: 0; box-shadow: 0 -18px 45px rgba(18,50,74,.24); left: 0; max-height: min(66vh, 560px); position: fixed; right: 0; z-index: 60; }
      }
    `}</style>
  )
}
