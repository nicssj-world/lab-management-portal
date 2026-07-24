import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { DeptRole } from '@/lib/supabase/types'

type Person = { id: string; name: string; dept: string | null; dept_role: DeptRole | null; position_title: string | null; role: string | null; avatar_url: string | null }

const ROLE_LABEL: Record<DeptRole, string> = {
  group_lead: 'หัวหน้ากลุ่มงาน',
  group_deputy: 'รองหัวหน้ากลุ่มงาน',
  section_head: 'หัวหน้างาน',
}

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }

function PersonBox({ person, tone }: { person: Person; tone?: string }) {
  const accent = tone ?? 'var(--border)'
  return (
    <Link href={`/staff/personnel/${person.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${accent}`, borderRadius: 10, background: 'var(--card)', minWidth: 200 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {person.avatar_url ? <img src={person.avatar_url} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, color: 'var(--muted)' }}>{person.name.charAt(0)}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{person.dept_role ? ROLE_LABEL[person.dept_role] : (person.position_title ?? person.role ?? '')}</div>
        </div>
      </div>
    </Link>
  )
}

export default async function TeamOrgPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dept, dept_role, position_title, role, avatar_url')
    .is('deleted_at', null)
    .order('name')
  const people = (data ?? []) as Person[]

  const groupLeads = people.filter((p) => p.dept_role === 'group_lead')
  const groupDeputies = people.filter((p) => p.dept_role === 'group_deputy')
  const sections = DEPARTMENTS
    .map((dept) => ({
      dept,
      heads: people.filter((p) => p.dept === dept && p.dept_role === 'section_head'),
      members: people.filter((p) => p.dept === dept && p.dept_role == null),
    }))
    .filter((s) => s.heads.length > 0 || s.members.length > 0)

  const connector = <div style={{ width: 2, height: 18, background: 'var(--border)', margin: '0 auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <PageHeader eyebrow="กลุ่มงานเทคนิคการแพทย์" title="ผังองค์กรกลุ่มงาน" subtitle="ตามหัวหน้างานและบุคลากรในแต่ละงาน" marginBottom={0} />
        <Link href="/staff/personnel/manage" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <Icon name="settings" size={15} /> จัดการกลุ่มงาน
        </Link>
      </div>

      {/* group leadership */}
      {(groupLeads.length > 0 || groupDeputies.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {groupLeads.map((p) => <PersonBox key={p.id} person={p} tone="var(--primary)" />)}
          </div>
          {groupDeputies.length > 0 && connector}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {groupDeputies.map((p) => <PersonBox key={p.id} person={p} tone="#7C3AED" />)}
          </div>
        </div>
      )}

      {/* sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {sections.map((s) => (
          <div key={s.dept} style={card}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>{s.dept}</div>
            {s.heads.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: s.members.length ? 10 : 0 }}>
                {s.heads.map((p) => <PersonBox key={p.id} person={p} tone="#D97706" />)}
              </div>
            )}
            {s.members.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: s.heads.length ? 14 : 0, borderLeft: s.heads.length ? '2px solid var(--border)' : 'none' }}>
                {s.members.map((p) => <PersonBox key={p.id} person={p} />)}
              </div>
            )}
          </div>
        ))}
      </div>
      {sections.length === 0 && groupLeads.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>ยังไม่มีบุคลากร — กำหนดหัวหน้างานได้ที่หน้า “จัดการกลุ่มงาน”</div>
      )}
    </div>
  )
}
