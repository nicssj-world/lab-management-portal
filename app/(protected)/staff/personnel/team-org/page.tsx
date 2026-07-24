import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { createStaffSignedUrl } from '@/lib/personnel/storage'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { DeptRole } from '@/lib/supabase/types'

type Person = { id: string; name: string; dept: string | null; dept_role: DeptRole | null; is_section_head: boolean; position_title: string | null; role: string | null; photo: string | null }
type WorkGroup = { id: string; name: string | null; depts: string[] }

const ROLE_LABEL: Record<DeptRole, string> = {
  group_lead: 'หัวหน้ากลุ่มงานเทคนิคการแพทย์',
  group_deputy: 'รองหัวหน้ากลุ่มงานเทคนิคการแพทย์',
}

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }
const CSS = `
@keyframes toRise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
.to-rise{opacity:0;animation:toRise .4s cubic-bezier(.22,1,.36,1) forwards}
.to-card{transition:transform .15s ease,box-shadow .15s ease}
.to-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,23,42,.10)}
@media(prefers-reduced-motion:reduce){.to-rise{animation:none;opacity:1}.to-card:hover{transform:none}}
`

function PersonBox({ person, tone, roleLabel }: { person: Person; tone?: string; roleLabel?: string }) {
  const accent = tone ?? 'var(--border)'
  const sub = roleLabel ?? (person.dept_role ? ROLE_LABEL[person.dept_role] : person.is_section_head ? 'หัวหน้างาน' : (person.position_title ?? person.role ?? ''))
  return (
    <Link href={`/staff/personnel/${person.id}`} style={{ textDecoration: 'none' }}>
      <div className="to-card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', border: `1px solid ${accent}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, background: 'var(--card)', minWidth: 200 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)' }}>
          {person.photo
            ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%', display: 'block' }} />
            : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}><span style={{ fontWeight: 800, color: 'var(--muted)', fontSize: 19 }}>{person.name.charAt(0)}</span></div>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub}</div>
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

  const [{ data: profileData }, { data: groupData }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, name, dept, dept_role, is_section_head, position_title, role, avatar_url, official_photo_url').is('deleted_at', null).order('name'),
    supabaseAdmin.from('personnel_work_groups').select('id, name, depts').order('created_at', { ascending: true }),
  ])
  const raw = profileData ?? []
  const photos = await Promise.all(raw.map((p) => (p.official_photo_url ? createStaffSignedUrl(p.official_photo_url) : Promise.resolve(null))))
  const people: Person[] = raw.map((p, i) => ({
    id: p.id, name: p.name, dept: p.dept, dept_role: p.dept_role, is_section_head: p.is_section_head ?? false,
    position_title: p.position_title, role: p.role, photo: photos[i] ?? p.avatar_url ?? null,
  }))
  const groups = (groupData ?? []) as WorkGroup[]

  const groupLeads = people.filter((p) => p.dept_role === 'group_lead')
  const groupDeputies = people.filter((p) => p.dept_role === 'group_deputy')

  // A section = one or more งาน displayed together. heads = anyone flagged หัวหน้างาน
  // (incl. a รองหัวหน้ากลุ่มงาน who also leads their งาน); members = the rest of the งาน.
  const sectionFrom = (depts: string[]) => ({
    heads: people.filter((p) => p.dept && depts.includes(p.dept) && p.is_section_head),
    members: people.filter((p) => p.dept && depts.includes(p.dept) && !p.is_section_head && p.dept_role == null),
  })
  const inGroup = new Set(groups.flatMap((g) => g.depts))
  const groupSections = groups.map((g) => ({ title: g.name ?? g.depts.join(' และ '), ...sectionFrom(g.depts) }))
  const standaloneSections = DEPARTMENTS.filter((d) => !inGroup.has(d)).map((d) => ({ title: d, ...sectionFrom([d]) }))
  const sections = [...groupSections, ...standaloneSections].filter((s) => s.heads.length > 0 || s.members.length > 0)

  const connector = <div style={{ width: 2, height: 18, background: 'var(--border)', margin: '0 auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{CSS}</style>
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
        {sections.map((s, i) => (
          <div key={s.title} className="to-rise" style={{ ...card, animationDelay: `${i * 45}ms` }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>{s.title}</div>
            {s.heads.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: s.members.length ? 10 : 0 }}>
                {s.heads.map((p) => <PersonBox key={p.id} person={p} tone="#D97706" roleLabel="หัวหน้างาน" />)}
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
