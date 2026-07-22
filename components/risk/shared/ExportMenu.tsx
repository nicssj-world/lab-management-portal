'use client'

import { Icon } from '@/components/ui/Icon'
import { FONT } from './tokens'

/**
 * ส่งออกตามตัวกรองที่กำลังใช้อยู่ — เป็นลิงก์จริงเพื่อให้ Tab ถึงและเปิดแท็บใหม่ได้
 * ส่ง query string ชุดเดียวกับหน้ารายการ ไฟล์ที่ได้จึงตรงกับที่เห็นบนจอ
 */
export function ExportMenu({ target, query }: { target: 'incidents' | 'register'; query: string }) {
  const base = `/api/admin/risk/export?target=${target}${query ? `&${query}` : ''}`
  return (
    <>
      <style>{`
        .risk-export-link{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font-size:13px;font-weight:600;text-decoration:none;transition:border-color .15s ease}
        .risk-export-link:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .risk-export-link:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        @media(prefers-reduced-motion:reduce){.risk-export-link{transition:none}}
      `}</style>
      <a className="risk-export-link" href={`${base}&format=xlsx`} style={{ fontSize: FONT.md }}>
        <Icon name="download" size={15} />Excel
      </a>
      <a className="risk-export-link" href={`${base}&format=pdf`} style={{ fontSize: FONT.md }}>
        <Icon name="doc" size={15} />PDF
      </a>
    </>
  )
}
