'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PublicDepartmentSdsGroup } from '@/lib/chemical-safety/public-types'

/**
 * คลังเอกสาร SDS แยกตามงาน
 * แสดงเฉพาะงานที่หัวหน้างานกดเผยแพร่แล้ว งานที่ยังไม่เผยแพร่จะไม่ถูกส่งมาถึงที่นี่เลย
 */
export function PublicDepartmentSds({
  groups,
  initialDepartment = '',
}: {
  groups: PublicDepartmentSdsGroup[]
  initialDepartment?: string
}) {
  const initialActive = groups.some(item => item.code === initialDepartment)
    ? initialDepartment
    : groups[0]?.code ?? ''
  const [active, setActive] = useState(initialActive)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!groups.some(item => item.code === initialDepartment)) return
    setActive(initialDepartment)
    setSearch('')
  }, [groups, initialDepartment])

  const group = useMemo(
    () => groups.find(item => item.code === active) ?? groups[0] ?? null,
    [groups, active],
  )

  const items = useMemo(() => {
    if (!group) return []
    const needle = debouncedSearch.trim().toLocaleLowerCase('th')
    if (!needle) return group.items
    return group.items.filter(item => item.displayName.toLocaleLowerCase('th').includes(needle))
  }, [group, debouncedSearch])

  function selectDepartment(code: string) {
    setActive(code)
    setSearch('')
    const params = new URLSearchParams(location.search)
    params.set('department', code)
    history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`)
  }

  if (groups.length === 0) {
    return (
      <section className="sds-dept sds-dept-empty-state" aria-labelledby="sds-dept-heading">
        <style>{`
          .sds-dept-empty-state{margin:0 0 30px;padding:18px 20px;border:1px dashed var(--border);border-radius:14px;background:var(--card)}
          .sds-dept-empty-state h2{margin:0;font-size:20px;color:var(--ink);letter-spacing:-.02em}
          .sds-dept-empty-state .sds-dept-empty{margin:6px 0 0;color:var(--muted);font-size:13px}
        `}</style>
        <h2 id="sds-dept-heading">SDS แยกตามงาน</h2>
        <p className="sds-dept-empty">ยังไม่มีงานใดเผยแพร่คลังเอกสาร SDS</p>
      </section>
    )
  }

  return (
    <section className="sds-dept" aria-labelledby="sds-dept-heading">
      <style>{`
        .sds-dept{margin:0 0 40px}
        .sds-dept h2{margin:0;font-size:clamp(20px,3vw,28px);color:var(--ink);letter-spacing:-.02em}
        .sds-dept-lead{margin:6px 0 18px;color:var(--muted);font-size:13px;max-width:70ch;line-height:1.65}
        .sds-dept-empty{color:var(--muted);font-size:13px}
        .sds-dept-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;scrollbar-width:thin}
        .sds-dept-tab{display:inline-flex;align-items:center;gap:8px;min-height:44px;flex:0 0 auto;padding:8px 16px;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:color .18s ease,background .18s ease,border-color .18s ease}
        .sds-dept-tab:hover{color:var(--ink);border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .sds-dept-tab[aria-pressed="true"]{color:var(--ink);background:var(--primary-soft);border-color:color-mix(in srgb,var(--primary) 40%,var(--border));font-weight:800}
        .sds-dept-tab:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .sds-dept-count{min-width:24px;padding:1px 8px;border-radius:999px;background:var(--surface-2);font-size:11px;text-align:center;font-weight:700}
        .sds-dept-search{width:100%;max-width:420px;min-height:46px;margin-bottom:14px;padding:0 14px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);font:inherit}
        .sds-dept-search:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .sds-dept-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;list-style:none;margin:0;padding:0}
        .sds-dept-item a{display:flex;align-items:center;gap:10px;min-height:52px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--ink);text-decoration:none;font-size:13px;font-weight:600;line-height:1.45;transition:border-color .18s ease,box-shadow .18s ease}
        .sds-dept-item a:hover{border-color:var(--primary);box-shadow:0 8px 24px rgba(15,23,42,.08)}
        .sds-dept-item a:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .sds-dept-item svg{flex:0 0 auto;color:var(--primary)}
        .sds-dept-none{grid-column:1/-1;color:var(--muted);font-size:13px;padding:20px 0}
        @media(prefers-reduced-motion:reduce){.sds-dept-tab,.sds-dept-item a{transition:none}}
      `}</style>

      <h2 id="sds-dept-heading">SDS แยกตามงาน</h2>
      <p className="sds-dept-lead">
        เอกสารข้อมูลความปลอดภัยของน้ำยาและชุดตรวจที่แต่ละงานใช้จริง
        หัวหน้างานเป็นผู้รับรองและเผยแพร่ชุดเอกสารของงานนั้น
      </p>

      <div className="sds-dept-tabs" role="group" aria-label="เลือกงาน">
        {groups.map(item => (
          <button
            key={item.code}
            type="button"
            className="sds-dept-tab"
            aria-pressed={group?.code === item.code}
            onClick={() => selectDepartment(item.code)}
          >
            <span>{item.department}</span>
            <span className="sds-dept-count">{item.items.length}</span>
          </button>
        ))}
      </div>

      {group && (
        <>
          <label>
            <span className="sr-only-visually" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
              ค้นหาเอกสารใน{group.department}
            </span>
            <input
              className="sds-dept-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`ค้นหาเอกสารใน${group.department}`}
            />
          </label>

          <ul className="sds-dept-list">
            {items.length === 0 ? (
              <li className="sds-dept-none">ไม่พบเอกสารที่ตรงกับคำค้น</li>
            ) : items.map(item => (
              <li key={item.publicId} className="sds-dept-item">
                <a
                  href={`/api/public/department-sds/${item.publicId}/file?disposition=inline`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <span>{item.displayName}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
