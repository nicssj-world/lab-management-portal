'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LabMapCanvas } from '@/components/lab-map/LabMapCanvas'
import { LabMapStyles } from '@/components/lab-map/LabMapStyles'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { PageHeader } from '@/components/ui/PageHeader'
import type { LabMapDTO } from '@/lib/lab-map/types'
import { RISK_NAVIGATION } from '@/lib/navigation'

type Level = 'low' | 'medium' | 'high' | 'unassessed'
type Point = { spaceCode: string; count: number; level: Level; maxSeverity?: string | null; unassessedCount: number }
type LayerResult = { layer: 'incidents' | 'register'; fromDate?: string; months?: number; points: Point[] }

export function RiskMapClient({ map }: { map: LabMapDTO }) {
  const router = useRouter()
  const [layer, setLayer] = useState<'incidents' | 'register'>('incidents')
  const [data, setData] = useState<Partial<Record<'incidents' | 'register', LayerResult>>>({})
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all(['incidents', 'register'].map(async candidate => {
      const response = await fetch(`/api/admin/risk/map?layer=${candidate}&months=12`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'โหลดแผนที่ความเสี่ยงไม่สำเร็จ')
      return json as LayerResult
    })).then(results => {
      if (!active) return
      setData({ incidents: results[0], register: results[1] })
    }).catch(reason => { if (active) setError((reason as Error).message) })
    return () => { active = false }
  }, [])

  const current = data[layer]
  const pointsByCode = useMemo(() => new Map((current?.points ?? []).map(point => [point.spaceCode, point])), [current])
  const tones = useMemo(() => Object.fromEntries((current?.points ?? []).map(point => [point.spaceCode, point.level])), [current])
  const selected = selectedCode ? pointsByCode.get(selectedCode) : undefined

  function openSpace(code: string) {
    setSelectedCode(code)
    const point = pointsByCode.get(code)
    if (!point) return
  }

  function openList() {
    if (!selectedCode) return
    if (layer === 'incidents') router.push(`/staff/risk/ior?spaceCode=${encodeURIComponent(selectedCode)}&fromDate=${current?.fromDate ?? ''}`)
    else router.push(`/staff/risk/register?spaceCode=${encodeURIComponent(selectedCode)}&active=1`)
  }

  return <div className="lab-map-shell" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
    <LabMapStyles />
    <PageHeader eyebrow="RISK LOCATION ANALYTICS" title="แผนที่ความเสี่ยง" subtitle="ดูจุดเกิดเหตุซ้ำและความเสี่ยงเชิงรุกโดยไม่รวมข้อมูล Smart-RM" marginBottom={0} />
    <ModuleSubnav items={RISK_NAVIGATION} label="เมนูทะเบียนความเสี่ยง" />
    {error ? <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="ชั้นข้อมูลความเสี่ยง">
      <button type="button" role="tab" aria-selected={layer === 'incidents'} onClick={() => { setLayer('incidents'); setSelectedCode(null) }} style={tabStyle(layer === 'incidents')}>อุบัติการณ์ 12 เดือน</button>
      <button type="button" role="tab" aria-selected={layer === 'register'} onClick={() => { setLayer('register'); setSelectedCode(null) }} style={tabStyle(layer === 'register')}>ทะเบียนความเสี่ยงที่ยังไม่ปิด</button>
    </div>
    <LabMapCanvas map={map} mode="overview" selectedCode={selectedCode} activeRouteCodes={[]} onSelect={openSpace} spaceTones={tones} />
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }} aria-label="คำอธิบายระดับความเสี่ยง">
      <Legend tone="#c92a2a" label="สูง" /><Legend tone="#e67700" label="ปานกลาง" />
      <Legend tone="#2b8a3e" label="ต่ำ" /><Legend tone="#6c757d" label="ยังไม่ประเมิน" pattern />
    </div>
    {selected ? <section style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
      <strong>{map.spaces.find(space => space.code === selected.spaceCode)?.nameTh ?? selected.spaceCode}</strong>
      <p style={{ margin: '5px 0', color: 'var(--muted)' }}>{selected.count} รายการ · ระดับสูงสุด {selected.maxSeverity ?? selected.level}{selected.unassessedCount ? ` · ยังไม่ประเมิน ${selected.unassessedCount}` : ''}</p>
      <button type="button" onClick={openList} style={{ minHeight: 44, padding: '8px 14px', border: 0, borderRadius: 8, background: 'var(--primary)', color: '#fff', cursor: 'pointer', font: 'inherit', fontWeight: 650 }}>ดูรายการที่กรองแล้ว</button>
    </section> : null}
  </div>
}

function Legend({ tone, label, pattern = false }: { tone: string; label: string; pattern?: boolean }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${tone}`, background: pattern ? `repeating-linear-gradient(135deg,${tone} 0 2px,transparent 2px 5px)` : tone }} />{label}</span>
}

function tabStyle(active: boolean): React.CSSProperties {
  return { minHeight: 44, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: active ? 'var(--primary)' : 'var(--card)', color: active ? '#fff' : 'var(--ink)', cursor: 'pointer', font: 'inherit', fontWeight: 650 }
}
