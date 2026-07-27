import type { Metadata } from 'next'
import { PublicDepartmentSds } from '@/components/chemical-safety/PublicDepartmentSds'
import { PublicSdsLibrary } from '@/components/chemical-safety/PublicSdsLibrary'
import { PublicStorageLayout } from '@/components/chemical-safety/PublicStorageLayout'
import { getPublicStorageLayout, listPublicDepartmentSds, searchPublicSds } from '@/lib/chemical-safety/public'

// หน้านี้เปิดสาธารณะโดยตั้งใจ — ไม่มี guard ใด ๆ
// ข้อมูลที่ส่งออกถูกคัดกรองในชั้น lib/chemical-safety/public.ts แล้ว
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'SDS | ข้อมูลความปลอดภัยสารเคมี',
  description: 'ผังการจัดเก็บสารเคมี เอกสารข้อมูลความปลอดภัย (SDS) แยกตามงาน และคู่มือความปลอดภัย MN-LAB-02',
}

export default async function PublicSdsPage() {
  const [items, layout, departments] = await Promise.all([
    searchPublicSds(),
    getPublicStorageLayout(),
    listPublicDepartmentSds(),
  ])

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

        .sds-nav{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0 34px}
        .sds-nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--ink);text-decoration:none;font-size:13px;font-weight:700;transition:border-color .18s ease,background .18s ease}
        .sds-nav a:hover{border-color:var(--primary);background:var(--primary-soft)}
        .sds-nav a:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}

        .manual-banner{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:0 0 40px;padding:20px 22px;border:1px solid var(--border);border-left:8px solid var(--warning);border-radius:16px;background:var(--card)}
        .manual-banner strong{display:block;font-size:17px;color:var(--ink)}
        .manual-banner span{font-size:13px;color:var(--muted)}
        .manual-banner a{min-height:44px;display:inline-flex;align-items:center;padding:0 18px;border-radius:10px;background:var(--primary);color:#fff;text-decoration:none;font-weight:800;white-space:nowrap;transition:filter .18s ease}
        .manual-banner a:hover{filter:brightness(.94)}
        .manual-banner a:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}

        .sds-section-head{margin:0 0 18px}
        .sds-section-head h2{margin:0;font-size:clamp(20px,3vw,28px);letter-spacing:-.02em}
        .sds-section-head p{margin:6px 0 0;color:var(--muted);font-size:13px;max-width:74ch;line-height:1.65}

        .sds-filter-panel{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:14px;margin:0 0 20px;padding:18px;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:0 10px 34px rgba(8,43,79,.07)}
        .sds-filter-panel label{display:grid;gap:7px;font-size:12px;font-weight:800;color:var(--muted)}
        .sds-filter-panel input,.sds-filter-panel select{width:100%;min-height:46px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--ink);padding:0 13px;font:inherit}
        .sds-filter-panel input:focus-visible,.sds-filter-panel select:focus-visible,.sds-actions a:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}

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
        .sds-actions a{min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border-radius:10px;text-decoration:none;font-weight:800;font-size:13px;background:var(--primary);color:#fff;transition:filter .18s ease}
        .sds-actions a:hover{filter:brightness(.94)}
        .sds-actions a + a{background:transparent;color:var(--primary);border:1px solid var(--primary)}

        .sds-state{text-align:center;padding:30px;color:var(--muted)}
        .sds-error{color:var(--danger);font-weight:600}
        .sds-card-skeleton{display:grid;gap:12px;border-top-color:var(--border)}
        .sds-skel{border-radius:6px;background:var(--surface-2)}

        @media(max-width:980px){.sds-filter-panel{grid-template-columns:1fr 1fr}}
        @media(max-width:850px){.sds-card-grid{grid-template-columns:1fr}.sds-filter-panel{grid-template-columns:1fr}.manual-banner{align-items:flex-start;flex-direction:column}.sds-card dl{grid-template-columns:1fr}.sds-public-page{padding:20px 14px 48px}.sds-hero{padding:28px 22px}}
        @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
      `}</style>

      <section className="sds-hero">
        <p className="sds-kicker">CHEMICAL SAFETY · ALL DEPARTMENTS</p>
        <h1>ข้อมูลความปลอดภัยสารเคมี<br />เข้าถึงได้โดยไม่ต้องล็อกอิน</h1>
        <p>
          ผังการจัดเก็บสารเคมีในห้องเก็บสารเคมี การจำแนกความเป็นอันตรายตามระบบ GHS
          และเอกสารข้อมูลความปลอดภัย (SDS) ของทุกงาน โดยไม่เปิดเผยปริมาณคงคลังหรือข้อมูลภายใน
        </p>
      </section>

      <nav className="sds-nav" aria-label="ทางลัดไปยังแต่ละส่วน">
        <a href="#sds-layout-heading">ผังการจัดเก็บ</a>
        <a href="#sds-chemicals-heading">สารเคมีในห้องเก็บสารเคมี</a>
        <a href="#sds-dept-heading">SDS แยกตามงาน</a>
        <a href="#sds-manual">คู่มือความปลอดภัย</a>
      </nav>

      <PublicStorageLayout layout={layout} />

      <section aria-labelledby="sds-chemicals-heading" style={{ margin: '0 0 40px' }}>
        <div className="sds-section-head">
          <h2 id="sds-chemicals-heading">สารเคมีในห้องเก็บสารเคมี</h2>
          <p>
            สารเคมีทุกตัวในบัญชีรายการพร้อมการจำแนกอันตรายตามระบบ GHS
            สารที่เอกสาร SDS ยังอยู่ระหว่างการทบทวนจะแสดงข้อมูลการจำแนกไว้ แต่ยังไม่เปิดให้ดาวน์โหลดไฟล์
          </p>
        </div>
        <PublicSdsLibrary initialItems={items} />
      </section>

      <PublicDepartmentSds groups={departments} />

      <aside className="manual-banner" id="sds-manual">
        <div>
          <strong>MN-LAB-02 คู่มือความปลอดภัยทางห้องปฏิบัติการ</strong>
          <span>ฉบับประกาศใช้ปัจจุบัน · เปิดอ่านได้โดยไม่ต้องล็อกอิน</span>
        </div>
        <a href="/api/public/safety-manual/MN-LAB-02?disposition=inline" target="_blank" rel="noopener noreferrer">
          เปิดคู่มือความปลอดภัย
        </a>
      </aside>
    </main>
  )
}
