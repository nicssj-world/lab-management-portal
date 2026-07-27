import { GhsPictogram } from './GhsPictogram'
import type { PublicStorageLayout as Layout } from '@/lib/chemical-safety/public-types'

/**
 * ผังการจัดเก็บสารเคมีสำหรับหน้าสาธารณะ
 *
 * แสดงตำแหน่งตู้และชื่อสาร แต่ไม่เปิดเผยปริมาณคงคลัง เลขล็อต หรือจำนวนขั้นต่ำ
 * ตู้ทุกใบมีรหัสตัวอักษรกำกับ (A1, B3, …) จึงอ่านได้แม้พิมพ์ขาวดำหรือมองสีไม่ชัด
 */
export function PublicStorageLayout({ layout }: { layout: Layout }) {
  const rows = [...new Set(layout.zones.map(zone => zone.displayRow))].sort()

  return (
    <section className="sds-layout" aria-labelledby="sds-layout-heading">
      <style>{`
        .sds-layout{margin:0 0 40px}
        .sds-layout-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
        .sds-layout-head h2{margin:0;font-size:clamp(20px,3vw,28px);color:var(--ink);letter-spacing:-.02em}
        .sds-layout-head p{margin:6px 0 0;color:var(--muted);font-size:13px}
        .sds-layout-updated{font-size:12px;font-weight:700;color:var(--muted);padding:6px 12px;border:1px solid var(--border);border-radius:999px;background:var(--card);white-space:nowrap}
        .sds-layout-row{display:grid;gap:14px;margin-bottom:14px}
        .sds-zone{border:1px solid var(--border);border-radius:16px;background:var(--card);padding:16px;min-width:0}
        .sds-zone-title{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:14px;font-weight:800;color:var(--ink)}
        .sds-zone-swatch{width:12px;height:12px;border-radius:3px;flex:0 0 auto}
        .sds-cabinets{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
        .sds-cabinet{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column}
        .sds-cabinet-code{padding:8px 12px;color:#fff;font-weight:800;font-size:13px;letter-spacing:.03em}
        .sds-cabinet-body{padding:11px 12px;flex:1}
        .sds-cabinet-body ul{margin:0;padding-left:16px;font-size:12.5px;line-height:1.6;color:var(--ink)}
        .sds-cabinet-body li{margin-bottom:5px}
        .sds-cabinet-empty{font-size:12px;color:var(--muted)}
        .sds-cabinet-ghs{display:flex;gap:3px;flex-wrap:wrap;margin-top:2px}
        .sds-summary{margin-top:22px;border:1px solid var(--border);border-radius:16px;background:var(--card);overflow:hidden}
        .sds-summary h3{margin:0;padding:14px 16px;font-size:14px;color:var(--ink);border-bottom:1px solid var(--border);background:var(--surface-2)}
        .sds-summary-scroll{overflow-x:auto}
        .sds-summary table{width:100%;border-collapse:collapse;min-width:420px}
        .sds-summary th,.sds-summary td{padding:10px 16px;text-align:left;font-size:13px;border-bottom:1px solid var(--border);color:var(--ink)}
        .sds-summary th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700}
        .sds-summary tr:last-child td{border-bottom:0}
        .sds-summary-codes{display:flex;gap:5px;flex-wrap:wrap}
        .sds-summary-code{padding:2px 9px;border-radius:999px;background:var(--surface-2);font-weight:700;font-size:12px}
        @media(max-width:900px){.sds-layout-row{grid-template-columns:1fr!important}}
      `}</style>

      <div className="sds-layout-head">
        <div>
          <h2 id="sds-layout-heading">ผังการจัดเก็บ{layout.roomNameTh}</h2>
          <p>ตำแหน่งจัดเก็บจริงในห้อง แยกตู้ตามประเภทความเป็นอันตรายเพื่อไม่ให้สารที่เข้ากันไม่ได้อยู่ด้วยกัน</p>
        </div>
        <span className="sds-layout-updated">ปรับปรุง {layout.updatedLabel}</span>
      </div>

      {rows.map(row => {
        const zones = layout.zones.filter(zone => zone.displayRow === row && zone.cabinets.length > 0)
        if (zones.length === 0) return null
        return (
          <div
            key={row}
            className="sds-layout-row"
            style={{ gridTemplateColumns: zones.map(zone => `${Math.max(zone.cabinets.length, 1)}fr`).join(' ') }}
          >
            {zones.map(zone => (
              <div key={zone.code} className="sds-zone">
                <h3 className="sds-zone-title">
                  <span className="sds-zone-swatch" aria-hidden="true" style={{ background: zone.color }} />
                  {zone.titleTh}
                </h3>
                <div className="sds-cabinets">
                  {zone.cabinets.map(cabinet => (
                    <div key={cabinet.code} className="sds-cabinet">
                      <div className="sds-cabinet-code" style={{ background: zone.color }}>{cabinet.code}</div>
                      <div className="sds-cabinet-body">
                        {cabinet.chemicals.length === 0 ? (
                          <span className="sds-cabinet-empty">ไม่มีรายการ</span>
                        ) : (
                          <ul>
                            {cabinet.chemicals.map(chemical => (
                              <li key={chemical.publicId}>
                                {chemical.name}
                                {chemical.pictogramCodes.length > 0 && (
                                  <span className="sds-cabinet-ghs">
                                    {chemical.pictogramCodes.map(code => (
                                      <GhsPictogram key={code} code={code} size={20} />
                                    ))}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}

      <div className="sds-summary">
        <h3>สรุปกลุ่มสารเคมีตามประเภท</h3>
        <div className="sds-summary-scroll">
          <table>
            <thead>
              <tr><th>กลุ่มสารเคมี</th><th>หมายเลขตู้</th></tr>
            </thead>
            <tbody>
              {layout.groupSummary.map(row => (
                <tr key={row.groupTh}>
                  <td>{row.groupTh}</td>
                  <td>
                    <span className="sds-summary-codes">
                      {row.locationCodes.map(code => (
                        <span key={code} className="sds-summary-code">{code}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
