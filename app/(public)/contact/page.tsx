import { Icon } from '@/components/ui/Icon'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createStaffSignedUrl } from '@/lib/personnel/storage'
import type { OrgChartNode } from '@/lib/supabase/types'
import { OrgStructure, type OrgNode } from './OrgStructure'

// Photos use 10-minute signed URLs → render fresh on every request.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ผังโครงสร้างองค์กร — กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  description: 'ผังโครงสร้างองค์กรและการแบ่งงาน กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
}

async function loadOrgNodes(): Promise<OrgNode[]> {
  const { data: nodes } = await supabaseAdmin
    .from('org_chart_nodes')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const rows = (nodes ?? []) as OrgChartNode[]

  const profileIds = [...new Set(rows.map((n) => n.profile_id).filter(Boolean))] as string[]
  const profileMap = new Map<string, { name: string; avatar_url: string | null; position_title: string | null }>()
  if (profileIds.length) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id, name, avatar_url, position_title').in('id', profileIds)
    for (const p of profs ?? []) profileMap.set(p.id, { name: p.name, avatar_url: p.avatar_url, position_title: p.position_title ?? null })
  }

  return Promise.all(rows.map(async (n) => {
    const linked = n.profile_id ? profileMap.get(n.profile_id) : undefined
    const photo = n.photo_url ? await createStaffSignedUrl(n.photo_url) : (linked?.avatar_url ?? null)
    return {
      id: n.id,
      parent_id: n.parent_id,
      title: n.title,
      node_type: n.node_type,
      display_name: n.person_name || linked?.name || null,
      position: linked?.position_title ?? null,
      photo,
      phone: n.phone,
      sort_order: n.sort_order,
    }
  }))
}

const LEGEND = [
  { label: 'ผู้บริหาร', color: '#64748B' },
  { label: 'ตำแหน่ง', color: '#1E5FAD' },
  { label: 'หน่วยงาน', color: '#0D9488' },
]

export default async function ContactPage() {
  const nodes = await loadOrgNodes()

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`
        .org-wrapper    { max-width: 1180px; margin: 0 auto; padding: 36px 28px 64px; }
        .org-page-title { font-size: 30px; font-weight: 800; color: var(--ink); margin: 0 0 6px; letter-spacing: -.01em; }
        @media (max-width: 768px) {
          .org-wrapper    { padding: 20px 16px 48px; }
          .org-page-title { font-size: 22px; }
        }
      `}</style>

      <div className="org-wrapper">

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>โครงสร้างองค์กร</div>
          <h1 className="org-page-title">ผังโครงสร้างกลุ่มงานเทคนิคการแพทย์</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.7 }}>
            โรงพยาบาลชลบุรี — โครงสร้างการบริหารและการแบ่งงาน พร้อมเบอร์โทรศัพท์ภายในของแต่ละหน่วยงาน
          </p>

          {/* External contact + legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
              <Icon name="phone" size={14} style={{ color: '#fff' }} /> (038) 931-455
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>โทรศัพท์กลาง — ต่อเบอร์ภายในของแต่ละหน่วยงาน</span>
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {LEGEND.map((l) => (
                <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                  <span style={{ width: 12, height: 3, borderRadius: 2, background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Org chart */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <OrgStructure nodes={nodes} />
        </div>

        {/* Footer note */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: '12px 18px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, fontSize: 12.5, color: '#92400E' }}>
          <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1, color: '#D97706' }} />
          <span>หมายเลขในกล่องเป็น <strong>เบอร์โทรศัพท์ภายใน</strong> สำหรับประสานงานในโรงพยาบาล กรณีติดต่อจากภายนอกกรุณาโทร <strong>(038) 931-455</strong> แล้วต่อเบอร์ภายใน</span>
        </div>

      </div>
    </main>
  )
}
