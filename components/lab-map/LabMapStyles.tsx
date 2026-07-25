export function LabMapStyles() {
  return (
    <style>{`
      .lab-map-shell {
        --map-navy: #12324a;
        --map-blue: #1d6f96;
        --map-cyan: #77b8c9;
        --map-safety: #f0b429;
        --map-room: #f7fafb;
        --map-controlled: #e7f1f4;
        --map-floor: #edf2f3;
        --map-line: #315260;
        --map-muted: #607785;
        --map-clean: #9bcf72;
        --map-infectious: #b4232a;
        --map-infectious-soft: #f4d2d4;
        --map-risk: #b88700;
        --map-risk-soft: #fff1a8;
        color: var(--ink);
        font-family: "Noto Sans Thai", sans-serif;
      }

      .lab-map-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 22px;
        padding: 4px 2px 0;
      }
      .lab-map-header h1 {
        color: var(--map-navy);
        font-size: clamp(1.65rem, 3vw, 2.65rem);
        line-height: 1.12;
        letter-spacing: -0.035em;
        margin: 7px 0 7px;
      }
      .lab-map-header > div > p:last-child {
        color: var(--map-muted);
        margin: 0;
      }
      .lab-map-eyebrow {
        align-items: center;
        color: var(--map-blue) !important;
        display: flex;
        font-family: "DM Mono", monospace;
        font-size: .7rem;
        font-weight: 500;
        gap: 9px;
        letter-spacing: .12em;
        margin: 0 !important;
        text-transform: uppercase;
      }
      .lab-map-eyebrow span {
        background: var(--map-safety);
        display: inline-block;
        height: 3px;
        width: 28px;
      }
      .lab-map-version {
        border-left: 4px solid var(--map-safety);
        color: var(--map-navy);
        flex: 0 0 auto;
        padding: 4px 0 4px 14px;
      }
      .lab-map-version span,
      .lab-map-version strong {
        display: block;
        font-family: "DM Mono", monospace;
      }
      .lab-map-version span { color: var(--map-muted); font-size: .62rem; letter-spacing: .13em; }
      .lab-map-version strong { font-size: .82rem; margin-top: 3px; }

      .lab-map-toolbar {
        align-items: flex-end;
        background: #fff;
        border: 1px solid #dbe5e8;
        border-radius: 14px 14px 0 0;
        display: flex;
        gap: 18px;
        justify-content: space-between;
        padding: 12px 14px;
      }
      .lab-map-mode-tabs { display: flex; gap: 4px; overflow-x: auto; }
      .lab-map-mode-tabs button {
        background: transparent;
        border: 0;
        border-radius: 9px;
        color: var(--map-muted);
        cursor: pointer;
        min-height: 44px;
        padding: 7px 13px;
        text-align: left;
        white-space: nowrap;
      }
      .lab-map-mode-tabs button span,
      .lab-map-mode-tabs button small { display: block; }
      .lab-map-mode-tabs button span { font-size: .83rem; font-weight: 700; }
      .lab-map-mode-tabs button small { font-family: "DM Mono", monospace; font-size: .58rem; letter-spacing: .05em; margin-top: 1px; }
      .lab-map-mode-tabs button[aria-pressed="true"] {
        background: var(--map-navy);
        color: #fff;
        box-shadow: 0 6px 18px rgba(18, 50, 74, .18);
      }

      .lab-map-search-wrap { min-width: min(330px, 36vw); position: relative; }
      .lab-map-search-wrap > label {
        color: var(--map-muted);
        display: block;
        font-family: "DM Mono", monospace;
        font-size: .6rem;
        letter-spacing: .11em;
        margin: 0 0 4px 2px;
        text-transform: uppercase;
      }
      .lab-map-search-field {
        align-items: center;
        background: #f4f7f8;
        border: 1px solid transparent;
        border-radius: 9px;
        display: flex;
        min-height: 44px;
        padding: 0 12px;
      }
      .lab-map-search-field:focus-within { background: #fff; border-color: var(--map-blue); box-shadow: 0 0 0 3px rgba(29, 111, 150, .12); }
      .lab-map-search-field > span { color: var(--map-blue); font-size: 1.3rem; margin-right: 8px; }
      .lab-map-search-field input {
        background: transparent;
        border: 0;
        color: var(--map-navy);
        font: inherit;
        font-size: .84rem;
        min-width: 0;
        outline: 0;
        width: 100%;
      }
      .lab-map-search-results {
        background: #fff;
        border: 1px solid #dbe5e8;
        border-radius: 10px;
        box-shadow: 0 18px 45px rgba(18, 50, 74, .18);
        left: 0;
        list-style: none;
        margin: 6px 0 0;
        max-height: 330px;
        overflow-y: auto;
        padding: 5px;
        position: absolute;
        right: 0;
        top: 100%;
        z-index: 20;
      }
      .lab-map-search-results button {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 7px;
        color: var(--map-navy);
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        min-height: 44px;
        padding: 8px 10px;
        text-align: left;
        width: 100%;
      }
      .lab-map-search-results button:hover { background: #eef5f7; }
      .lab-map-search-results small { color: var(--map-muted); flex: 0 0 auto; font-size: .67rem; margin-left: 10px; }

      .lab-map-workspace {
        background: #dfe8ea;
        border: 1px solid #ccdadd;
        border-top: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        min-height: 590px;
        overflow: hidden;
        position: relative;
      }
      .lab-map-canvas-frame { min-width: 0; padding: 18px; position: relative; }
      .lab-map-svg-scroll {
        background-color: #d7e2e5;
        background-image: linear-gradient(rgba(49, 82, 96, .055) 1px, transparent 1px), linear-gradient(90deg, rgba(49, 82, 96, .055) 1px, transparent 1px);
        background-size: 22px 22px;
        border: 1px solid rgba(49, 82, 96, .18);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.55), 0 16px 36px rgba(18,50,74,.10);
        height: 100%;
        min-height: 552px;
        overflow: hidden;
      }
      .lab-map-svg { cursor: grab; display: block; height: 100%; min-height: 552px; touch-action: none; width: 100%; }
      .lab-map-svg:active { cursor: grabbing; }
      .lab-map-floor { fill: var(--map-floor); stroke: #b9c9cd; stroke-width: 2; }

      .lab-map-space { cursor: pointer; outline: none; }
      .lab-map-space > rect,
      .lab-map-space > polygon,
      .lab-map-space > path {
        fill: var(--space-fill);
        stroke: var(--map-line);
        stroke-width: 1.7;
        transition: filter .16s ease, stroke-width .16s ease, opacity .16s ease;
        vector-effect: non-scaling-stroke;
      }
      .lab-map-space:hover > rect,
      .lab-map-space:hover > polygon,
      .lab-map-space:hover > path { filter: brightness(.97); stroke-width: 3; }
      .lab-map-space:focus-visible > rect,
      .lab-map-space:focus-visible > polygon,
      .lab-map-space:focus-visible > path { filter: drop-shadow(0 0 5px rgba(240, 180, 41, .72)); stroke: var(--map-safety); stroke-width: 5; }
      .lab-map-space[data-selected] > rect,
      .lab-map-space[data-selected] > polygon,
      .lab-map-space[data-selected] > path,
      .lab-map-space[data-highlighted] > rect,
      .lab-map-space[data-highlighted] > polygon,
      .lab-map-space[data-highlighted] > path { filter: brightness(.94); stroke: var(--map-safety); stroke-width: 5; }
      .lab-map-space-label {
        fill: var(--map-navy);
        font-family: "Noto Sans Thai", sans-serif;
        font-size: 12px;
        font-weight: 600;
        pointer-events: none;
      }

      .lab-map-route { pointer-events: none; }
      .lab-map-route polyline { fill: none; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
      .lab-map-route-halo { stroke: rgba(255,255,255,.9); stroke-width: 14; }
      .lab-map-route-line { stroke: var(--map-blue); stroke-dasharray: 9 7; stroke-width: 7; }

      .lab-map-point { color: var(--map-navy); fill: var(--map-safety); stroke: var(--map-navy); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.5; vector-effect: non-scaling-stroke; }
      .lab-map-point--exit { fill: #fff; stroke: #168347; }
      .lab-map-point[data-status="permanently_locked"] { fill: #d6dfe2; stroke: #8b2730; }

      .lab-map-zoom-controls {
        background: rgba(255,255,255,.95);
        border: 1px solid #c7d5d9;
        box-shadow: 0 9px 24px rgba(18,50,74,.14);
        display: flex;
        position: absolute;
        right: 30px;
        top: 30px;
        z-index: 5;
      }
      .lab-map-zoom-controls button {
        background: transparent;
        border: 0;
        border-right: 1px solid #d6e0e3;
        color: var(--map-navy);
        cursor: pointer;
        font: 700 1rem "DM Mono", monospace;
        min-height: 44px;
        min-width: 44px;
      }
      .lab-map-zoom-controls button:hover { background: #eef5f7; }
      .lab-map-zoom-controls .lab-map-reset { border-right: 0; font-family: "Noto Sans Thai", sans-serif; font-size: .72rem; padding: 0 12px; }

      .lab-map-detail-panel {
        background: #fff;
        border-left: 1px solid #ccdadd;
        min-width: 0;
        padding: 28px 24px;
        position: relative;
      }
      .lab-map-detail-panel h2 { color: var(--map-navy); font-size: 1.2rem; line-height: 1.35; margin: 3px 0 4px; }
      .lab-map-detail-type { color: var(--map-blue); font-family: "DM Mono", monospace; font-size: .64rem; letter-spacing: .12em; margin: 0; text-transform: uppercase; }
      .lab-map-detail-en { color: var(--map-muted); font-family: "DM Mono", monospace; font-size: .72rem; margin: 0 0 22px; }
      .lab-map-detail-block { border-top: 1px solid #e3eaec; margin-top: 22px; padding-top: 16px; }
      .lab-map-detail-block > span { color: var(--map-muted); font-size: .7rem; font-weight: 600; }
      .lab-map-detail-block ul { margin: 7px 0 0; padding-left: 20px; }
      .lab-map-detail-block li { font-size: .82rem; margin: 4px 0; }
      .lab-map-access-note { background: #fff7dc; border-left: 3px solid var(--map-safety); color: #654c08; font-size: .78rem; margin: 22px 0 0; padding: 10px 12px; }
      .lab-map-detail-close { background: #eef3f4; border: 0; border-radius: 50%; color: var(--map-navy); cursor: pointer; font-size: 1.25rem; min-height: 44px; min-width: 44px; position: absolute; right: 12px; top: 12px; }
      .lab-map-empty-detail { color: var(--map-muted); margin-top: 25%; text-align: center; }
      .lab-map-empty-detail > span { color: var(--map-cyan); display: block; font: 400 3.5rem "DM Mono", monospace; }
      .lab-map-empty-detail h2 { font-size: .98rem; }
      .lab-map-empty-detail p { font-size: .78rem; }

      .lab-map-legend { align-items: center; background: var(--map-navy); color: #fff; display: flex; flex-wrap: wrap; gap: 20px; padding: 11px 16px; }
      .lab-map-legend span { align-items: center; display: flex; font-size: .75rem; gap: 7px; }
      .lab-map-legend i { border: 1px solid rgba(255,255,255,.7); display: inline-block; height: 17px; width: 25px; }
      .lab-map-legend i[data-class="infectious"] { background: repeating-linear-gradient(135deg, var(--map-infectious), var(--map-infectious) 5px, var(--map-infectious-soft) 5px, var(--map-infectious-soft) 10px); }
      .lab-map-legend i[data-class="clean"] { background: var(--map-clean); }
      .lab-map-legend i[data-class="risk"] { background-color: var(--map-risk-soft); background-image: radial-gradient(var(--map-risk) 2px, transparent 2px); background-size: 8px 8px; }

      .lab-map-shell button:focus-visible,
      .lab-map-shell input:focus-visible { outline: 3px solid var(--map-safety); outline-offset: 2px; }

      @media (max-width: 920px) {
        .lab-map-toolbar { align-items: stretch; flex-direction: column; }
        .lab-map-search-wrap { min-width: 0; width: 100%; }
        .lab-map-workspace { grid-template-columns: minmax(0, 1fr) 260px; }
      }

      @media (max-width: 767px) {
        .lab-map-header { align-items: flex-start; flex-direction: column; }
        .lab-map-version { align-self: stretch; }
        .lab-map-toolbar { border-radius: 10px 10px 0 0; }
        .lab-map-mode-tabs button { flex: 0 0 auto; }
        .lab-map-workspace { display: block; min-height: 490px; overflow: visible; }
        .lab-map-canvas-frame { padding: 8px; }
        .lab-map-svg-scroll,
        .lab-map-svg { min-height: 470px; }
        .lab-map-zoom-controls { right: 16px; top: 16px; }
        .lab-map-detail-panel {
          border: 0;
          border-radius: 20px 20px 0 0;
          bottom: 0;
          box-shadow: 0 -18px 45px rgba(18,50,74,.24);
          left: 0;
          max-height: min(66vh, 560px);
          overflow-y: auto;
          padding: 28px 22px calc(24px + env(safe-area-inset-bottom));
          position: fixed;
          right: 0;
          transform: translateY(105%);
          transition: transform .22s ease;
          z-index: 60;
        }
        .lab-map-detail-panel[data-open] { transform: translateY(0); }
        .lab-map-empty-detail { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .lab-map-space > rect,
        .lab-map-space > polygon,
        .lab-map-space > path,
        .lab-map-detail-panel { transition: none; }
        .lab-map-route-line { stroke-dasharray: none; }
      }

      [data-theme="dark"] .lab-map-shell {
        --map-navy: #dcecf2;
        --map-room: #263640;
        --map-controlled: #284653;
        --map-floor: #1b2931;
        --map-line: #87a7b4;
        --map-muted: #9db2bb;
      }
      [data-theme="dark"] .lab-map-toolbar,
      [data-theme="dark"] .lab-map-detail-panel,
      [data-theme="dark"] .lab-map-search-results { background: #17242c; }
      [data-theme="dark"] .lab-map-search-field { background: #22323b; }
      [data-theme="dark"] .lab-map-workspace { background: #111d24; }
    `}</style>
  )
}
