export function SafetyAssetsStyles() {
  return <style>{`
    .safety-page{display:flex;flex-direction:column;gap:14px;min-width:0}
    .safety-tabs{display:flex;gap:6px;flex-wrap:wrap}
    .safety-tabs button,.safety-toolbar button,.safety-card{min-height:44px}
    .safety-tabs button{border:1px solid var(--border);border-radius:9px;padding:8px 14px;background:var(--card);color:var(--ink);font:inherit;font-weight:650;cursor:pointer}
    .safety-tabs button[aria-selected="true"]{background:var(--primary);border-color:var(--primary);color:#fff}
    .safety-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);gap:12px;align-items:start}
    .safety-sidebar{display:flex;flex-direction:column;gap:10px;min-width:0}
    .safety-toolbar{display:grid;grid-template-columns:minmax(140px,1fr) auto;gap:8px}
    .safety-toolbar input,.safety-toolbar select,.safety-form input,.safety-form select,.safety-form textarea{width:100%;min-height:44px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);padding:8px 10px;font:inherit}
    .safety-filter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.safety-filter-grid select{width:100%;min-height:44px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);padding:8px;font:inherit}
    .safety-form textarea{min-height:76px;resize:vertical}
    .safety-list{display:flex;flex-direction:column;gap:7px;max-height:560px;overflow:auto;overscroll-behavior:contain;padding:1px;content-visibility:auto}
    .safety-card{display:block;min-height:78px;width:100%;text-align:left;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);padding:10px;cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s}
    .safety-card:hover,.safety-card[data-selected="true"]{border-color:var(--primary);background:var(--primary-soft);box-shadow:inset 4px 0 0 var(--primary)}
    .safety-card:focus-visible,.safety-tabs button:focus-visible,.safety-form :focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 35%,transparent);outline-offset:2px}
    .safety-card-head,.safety-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .safety-card small{display:block;color:var(--muted);font-size:12px;line-height:1.45;margin-top:5px;overflow-wrap:anywhere}.safety-muted{color:var(--muted);font-size:12px}
    .safety-form{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--card)}
    .safety-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .safety-form label{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px;font-weight:600}
    .safety-photo{display:block;width:100%;max-height:220px;object-fit:cover;border-radius:9px;border:1px solid var(--border)}
    .safety-photo-picker{display:grid!important;gap:5px}.safety-photo-picker>span:first-child{color:var(--muted);font-size:12px;font-weight:600}.safety-photo-picker input{cursor:pointer}.safety-photo-picker small{color:var(--muted);font-size:12px;line-height:1.4}.safety-photo-picker small:not(:empty){min-height:17px}
    .safety-coordinate-note{padding:8px 10px;border-radius:8px;background:var(--primary-soft);color:var(--primary);font-size:12px}
    .safety-history{display:grid;gap:8px;margin-top:8px}.safety-history article{display:grid;gap:5px;padding:9px;border:1px solid var(--border);border-radius:8px}.safety-history small{color:var(--muted)}
    .safety-responsible{display:grid;gap:14px;padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--card)}
    .safety-responsible-heading{display:flex;align-items:start;justify-content:space-between;gap:16px}.safety-responsible-heading p{color:var(--primary);font-size:11px;font-weight:800;letter-spacing:.1em;margin:0 0 4px}.safety-responsible-heading h2{color:var(--ink);font-size:18px;margin:0}.safety-responsible-heading>div>span{display:block;color:var(--muted);font-size:13px;line-height:1.55;margin-top:5px;max-width:720px}
    .safety-responsible-count{align-items:center;background:var(--primary-soft);border:1px solid color-mix(in srgb,var(--primary) 22%,var(--border));border-radius:10px;display:flex;flex:0 0 auto;flex-direction:column;justify-content:center;min-height:76px;min-width:116px;padding:8px}.safety-responsible-count strong{color:var(--primary);font-size:24px;line-height:1}.safety-responsible-count span{color:var(--muted);font-size:11px;margin-top:4px}
    .safety-auto-editors{display:grid;gap:10px;padding:12px;border:1px solid #b9d7eb;border-radius:10px;background:#f1f8fc}.safety-auto-editors>div{display:grid;gap:3px}.safety-auto-editors>div strong{color:#12324a;font-size:14px}.safety-auto-editors>div span{color:#476b7d;font-size:12px}.safety-auto-editors ul{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}.safety-auto-editors li{align-items:center;background:#fff;border:1px solid #d5e7f1;border-radius:9px;display:flex;gap:8px;min-height:44px;padding:7px 9px}.safety-auto-editors li>span:nth-child(2){display:grid;gap:1px;line-height:1.15}.safety-auto-editors small{color:var(--muted);font-size:11px}
    .safety-avatar{align-items:center;background:#dceff7;border-radius:50%;color:#155875;display:inline-flex;flex:0 0 auto;font-size:13px;font-weight:800;height:32px;justify-content:center;text-transform:uppercase;width:32px}.safety-editor-search{display:grid;gap:5px;color:var(--muted);font-size:12px;font-weight:700}.safety-editor-search input{min-height:44px;width:100%;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);padding:8px 10px;font:inherit}
    .safety-editor-list{display:grid;gap:7px;max-height:520px;overflow:auto}.safety-editor-list article{align-items:center;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;padding:10px;border:1px solid var(--border);border-radius:10px}.safety-editor-list article>div{display:grid;gap:2px;min-width:0}.safety-editor-list article strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safety-editor-list article small{color:var(--muted);font-size:12px}
    .safety-mobile-switch{display:none}
    @media(max-width:767px){
      .safety-workspace{grid-template-columns:1fr}.safety-form-grid,.safety-filter-grid{grid-template-columns:1fr}.safety-responsible-heading{align-items:stretch;flex-direction:column}.safety-responsible-count{align-items:start;min-height:0}.safety-editor-list article{align-items:start;grid-template-columns:auto minmax(0,1fr)}.safety-editor-list article>span:nth-of-type(2),.safety-editor-list article button{grid-column:2}
      .safety-list{max-height:calc(100dvh - 238px);min-height:260px}.safety-card{min-height:82px;padding:11px}.safety-card-head{align-items:start}.safety-card-head strong{line-height:1.35}.safety-card-head .badge{flex:0 0 auto}
      .safety-mobile-switch{display:flex}.safety-workspace[data-mobile-view="list"] .safety-map-pane{display:none}
      .safety-workspace[data-mobile-view="map"] .safety-sidebar{display:none}
    }
    @media(prefers-reduced-motion:reduce){.safety-card{transition:none}}
  `}</style>
}
