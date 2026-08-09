import type { Metadata } from 'next'
import { PublicDepartmentSds } from '@/components/chemical-safety/PublicDepartmentSds'
import { PublicSdsLibrary } from '@/components/chemical-safety/PublicSdsLibrary'
import { SafetyManualActions } from '@/components/chemical-safety/SafetyManualActions'
import { listPublicDepartmentSds, searchPublicSds } from '@/lib/chemical-safety/public'

// หน้านี้เปิดสาธารณะโดยตั้งใจ — ไม่มี guard ใด ๆ
// ข้อมูลที่ส่งออกถูกคัดกรองในชั้น lib/chemical-safety/public.ts แล้ว
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'SDS | ข้อมูลด้านความปลอดภัยสารเคมี',
  description: 'ค้นหาเอกสารข้อมูลความปลอดภัย (SDS) แยกตามงานและตามชื่อสาร พร้อมคู่มือความปลอดภัย MN-LAB-02',
}

export default async function PublicSdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; department?: string | string[] }>
}) {
  const { q, department } = await searchParams
  const initialQuery = typeof q === 'string' ? q.trim().slice(0, 200) : ''
  const initialDepartment = typeof department === 'string' ? department : ''
  const [items, departments] = await Promise.all([
    searchPublicSds(),
    listPublicDepartmentSds(),
  ])
  const searchHints = [...new Set(
    items.flatMap(item => [item.canonicalName, ...item.aliases, item.manufacturer].filter((value): value is string => Boolean(value))),
  )].sort((a, b) => a.localeCompare(b, 'th'))

  return (
    <main className="sds-public-page">
      <style>{`
        .sds-public-page{max-width:1420px;margin:0 auto;padding:38px 24px 72px;color:var(--ink)}
        .sds-public-page h2,.sds-public-page h3{color:var(--ink)}

        .sds-hero{position:relative;overflow:hidden;padding:40px;border-radius:24px;background:linear-gradient(125deg,#082b4f,#0b4b75 62%,#087e80);color:#fff;box-shadow:0 24px 70px rgba(8,43,79,.22)}
        .sds-hero:after{content:"GHS";position:absolute;right:30px;top:-30px;font-size:150px;font-weight:900;color:rgba(255,255,255,.06);letter-spacing:-.08em;pointer-events:none}
        .sds-hero h1{font-size:clamp(30px,5vw,54px);line-height:1.06;margin:8px 0 14px;letter-spacing:-.03em;color:#fff}
        .sds-hero p{max-width:74ch;line-height:1.7;color:rgba(255,255,255,.86);margin:0}
        .sds-kicker{font-weight:800;letter-spacing:.16em;font-size:12px;color:#8ff0e9!important;margin:0!important}
        .sds-hero-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;max-width:760px;margin-top:24px}
        .sds-hero-search > label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        .sds-hero-search input{min-width:0;min-height:52px;flex:1;border:1px solid rgba(255,255,255,.45);border-radius:12px;background:#fff;color:var(--ink);padding:0 16px;font:inherit}
        .sds-hero-search button{min-height:52px;border:0;border-radius:12px;background:#8ff0e9;color:#063b58;padding:0 22px;font:inherit;font-weight:900;cursor:pointer}
        .sds-hero-search input:focus-visible,.sds-hero-search button:focus-visible{outline:3px solid #fff;outline-offset:3px}

        .manual-banner{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:20px 0 38px;padding:22px;border:1px solid color-mix(in srgb,var(--warning) 52%,var(--border));border-left:8px solid var(--warning);border-radius:16px;background:var(--card);box-shadow:0 10px 34px rgba(8,43,79,.07)}
        .manual-banner strong{display:block;font-size:17px;color:var(--ink)}
        .manual-banner span{font-size:13px;color:var(--muted)}
        .manual-actions{display:flex;gap:10px;flex-wrap:wrap}
        .manual-banner a,.manual-banner button{min-height:46px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border:1px solid var(--primary);border-radius:10px;background:transparent;color:var(--primary);text-decoration:none;font:inherit;font-weight:800;white-space:nowrap;cursor:pointer;transition:filter .18s ease,background .18s ease}
        .manual-banner a:hover,.manual-banner button:hover{filter:brightness(.94)}
        .manual-banner .manual-download{background:var(--primary);color:#fff}
        .manual-banner a:focus-visible,.manual-banner button:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}

        .sds-section-head{margin:0 0 18px}
        .sds-section-head h2{margin:0;font-size:clamp(20px,3vw,28px);letter-spacing:-.02em}
        .sds-section-head p{margin:6px 0 0;color:var(--muted);font-size:13px;max-width:100ch;line-height:1.65}

        .sds-filter-panel{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:14px;margin:0 0 20px;padding:18px;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:0 10px 34px rgba(8,43,79,.07)}
        .sds-filter-panel label{display:grid;gap:7px;font-size:12px;font-weight:800;color:var(--muted)}
        .sds-filter-panel input,.sds-filter-panel select{width:100%;min-height:46px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--ink);padding:0 13px;font:inherit}
        .sds-filter-panel input:focus-visible,.sds-filter-panel select:focus-visible,.sds-actions a:focus-visible,.sds-actions button:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}

        .sds-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
        .sds-card{display:flex;flex-direction:column;border:1px solid var(--border);border-top:5px solid var(--primary);border-radius:16px;padding:20px;background:var(--card);box-shadow:0 12px 34px rgba(8,43,79,.08)}
        .sds-card-head{display:flex;justify-content:space-between;gap:18px}
        .sds-card h3{margin:2px 0 5px;font-size:21px;letter-spacing:-.01em}
        .sds-card-head p{margin:0;color:var(--muted);font-size:13px}
        .sds-eyebrow{font-size:10px!important;font-weight:900;letter-spacing:.15em;color:var(--primary)!important}
        .sds-signal{height:34px;padding:0 12px;display:grid;place-items:center;border:1px solid var(--border);border-radius:999px;font-weight:900;font-size:13px;white-space:nowrap;color:var(--muted)}
        .sds-signal.is-alert{background:var(--danger);color:#fff;border-color:var(--danger)}

        .sds-tag-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}
        .sds-tag{padding:3px 10px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:11.5px;font-weight:700}
        .sds-tag.is-ok{background:rgba(22,163,74,.10);color:#15803D}
        .sds-tag.is-wait{background:rgba(217,119,6,.12);color:#B45309}

        .sds-card dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
        .sds-card dl div{padding:10px;background:var(--surface-2);border-radius:10px}
        .sds-card dt{font-size:10px;color:var(--muted);font-weight:800}
        .sds-card dd{margin:4px 0 0;font-size:13px;color:var(--ink)}
        .sds-ghs-row{display:flex;gap:10px;flex-wrap:wrap;padding:6px 0 12px}
        .sds-hazard-text{margin:0 0 12px;font-size:12.5px;color:var(--muted)}
        .sds-hazards{padding-left:20px;font-size:12px;line-height:1.55;color:var(--ink);margin:0 0 12px}
        .sds-pending-note{margin:auto 0 0;padding:11px 13px;border-radius:10px;background:var(--surface-2);color:var(--muted);font-size:12px;line-height:1.6}
        .sds-actions{display:flex;gap:10px;margin:auto 0 0;padding-top:6px}
        .sds-actions a,.sds-actions button{min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border:0;border-radius:10px;background:var(--primary);color:#fff;font:inherit;font-weight:800;font-size:13px;text-decoration:none;cursor:pointer;transition:filter .18s ease}
        .sds-actions a:hover,.sds-actions button:hover{filter:brightness(.94)}
        .sds-actions a + a{background:transparent;color:var(--primary);border:1px solid var(--primary)}

        .sds-state{text-align:center;padding:30px;color:var(--muted)}
        .sds-error{color:var(--danger);font-weight:600}
        .sds-card-skeleton{display:grid;gap:12px;border-top-color:var(--border)}
        .sds-skel{border-radius:6px;background:var(--surface-2)}

        @media(max-width:980px){.sds-filter-panel{grid-template-columns:1fr 1fr}}
        @media(max-width:850px){.sds-card-grid{grid-template-columns:1fr}.sds-filter-panel{grid-template-columns:1fr}.sds-hero-search{grid-template-columns:1fr}.sds-hero-search button{width:100%}.manual-banner{align-items:flex-start;flex-direction:column}.manual-actions{width:100%}.manual-actions a,.manual-actions button{flex:1}.sds-card dl{grid-template-columns:1fr}.sds-public-page{padding:20px 14px 48px}.sds-hero{padding:28px 22px}}
        @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
      `}</style>

      <section className="sds-hero">
        <p className="sds-kicker">SDS · POINT-OF-USE ACCESS</p>
        <h1>คลังเอกสาร SDS</h1>
        <p>
          ค้นหาและเปิดเอกสารข้อมูลความปลอดภัยของน้ำยา ชุดตรวจ และสารเคมีที่ใช้ในงานได้ทันที
        </p>
        <form className="sds-hero-search" action="/sds#sds-chemicals-heading">
          <label className="sr-only-visually" htmlFor="sds-hero-search">ค้นหาเอกสาร SDS</label>
          <input
            id="sds-hero-search"
            name="q"
            type="search"
            defaultValue={initialQuery}
            placeholder="ค้นหาชื่อสาร น้ำยา ชุดตรวจ CAS หรือผู้ผลิต"
            list="sds-hero-suggestions"
            autoComplete="off"
          />
          <button type="submit">ค้นหา SDS</button>
        </form>
        <datalist id="sds-hero-suggestions">
          {searchHints.map(hint => <option key={hint} value={hint} />)}
        </datalist>
      </section>

      <aside className="manual-banner" id="sds-manual">
        <div>
          <strong>MN-LAB-02 คู่มือความปลอดภัยทางห้องปฏิบัติการ</strong>
          <span>คู่มือปฏิบัติด้านความปลอดภัยฉบับปัจจุบัน</span>
        </div>
        <SafetyManualActions code="MN-LAB-02" title="MN-LAB-02 คู่มือความปลอดภัยทางห้องปฏิบัติการ" />
      </aside>

      <PublicDepartmentSds groups={departments} initialDepartment={initialDepartment} />

      <section aria-labelledby="sds-chemicals-heading" style={{ margin: '0 0 40px' }}>
        <div className="sds-section-head">
          <h2 id="sds-chemicals-heading">ค้นหา SDS ตามชื่อสาร</h2>
          <p>
            ค้นหาตามชื่อสาร น้ำยา ชุดตรวจ CAS หรือผู้ผลิต แล้วเลือกเปิดหรือดาวน์โหลดเอกสาร SDS ฉบับที่ผ่านการอนุมัติ
          </p>
        </div>
        <PublicSdsLibrary initialItems={items} initialQuery={initialQuery} />
      </section>
    </main>
  )
}
