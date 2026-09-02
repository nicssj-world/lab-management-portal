import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManagePersonnel } from '@/lib/personnel/roles'
import { normalizeRole } from '@/lib/roles'
import { createStaffSignedUrl } from '@/lib/personnel/storage'
import { formatProfileName } from '@/lib/personnel/name'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { PersonPreview } from '@/components/personnel/PersonPreview'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { DeptRole } from '@/lib/supabase/types'
import { TeamOrgAssignmentButton, type TeamOrgAssignmentPerson, type TeamOrgAssignmentSection } from './TeamOrgAssignmentDialog'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'เจ้าหน้าที่กลุ่มงานเทคนิคการแพทย์ — กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  description: 'รายชื่อเจ้าหน้าที่กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี แยกตามหัวหน้างานและงานที่รับผิดชอบ',
}

type Person = { id: string; name: string; dept: string | null; dept_role: DeptRole | null; is_section_head: boolean; team_org_visible: boolean; position_title: string | null; role: string | null; photo: string | null }
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
.team-person-avatar-button{display:grid;padding:0;border:0;border-radius:50%;background:transparent;cursor:zoom-in;flex-shrink:0;touch-action:manipulation}
.team-person-avatar-button:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.team-person-avatar-button>span{transition:transform .18s ease,box-shadow .18s ease}
.team-person-avatar-button:hover>span{transform:scale(1.06);box-shadow:0 5px 14px rgba(30,95,173,.20)}
.team-person-preview{position:fixed;z-index:1200;width:min(320px,calc(100vw - 24px));max-height:calc(100dvh - 24px);box-sizing:border-box;overflow:auto;padding:24px 18px 18px;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:0 20px 60px rgba(11,22,38,.25);text-align:center;animation:teamPreviewRise .2s cubic-bezier(.22,1,.36,1)}
.team-person-preview::after{content:'';position:absolute;width:11px;height:11px;background:var(--card);border-left:1px solid var(--border);border-bottom:1px solid var(--border);transform:rotate(45deg)}
.team-person-preview[data-placement="right"]::after{left:-6px;top:calc(50% - 6px)}
.team-person-preview[data-placement="left"]::after{right:-6px;top:calc(50% - 6px);transform:rotate(225deg)}
.team-person-preview[data-placement="bottom"]::after{top:-6px;left:calc(50% - 6px);transform:rotate(135deg)}
.team-person-preview[data-placement="top"]::after{bottom:-6px;left:calc(50% - 6px);transform:rotate(-45deg)}
.team-person-preview-close{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:44px;height:44px;box-sizing:border-box;padding:0;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);cursor:pointer;touch-action:manipulation;transition:background .15s ease,color .15s ease}
.team-person-preview-close:hover{background:var(--primary-soft);color:var(--primary)}
.team-person-preview-close:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.team-person-preview-photo{width:min(190px,58vw);height:min(190px,58vw);box-sizing:border-box;margin:0 auto 14px;overflow:hidden;border-radius:50%;background:var(--surface-2);display:grid;place-items:center;border:4px solid color-mix(in srgb,var(--primary) 18%,transparent)}
.team-person-preview h2{margin:0;color:var(--ink);font-size:18px;line-height:1.4}
.team-person-preview p{margin:4px 0 0;color:var(--muted);font-size:12.5px;line-height:1.5}
.team-section-title{margin:0 0 10px;color:var(--ink);font-size:13.5px;font-weight:800;line-height:1.45;min-height:39px;text-wrap:balance;overflow-wrap:anywhere}
@keyframes teamPreviewRise{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@media(prefers-reduced-motion:reduce){.to-rise{animation:none;opacity:1}.to-card:hover{transform:none}.team-person-avatar-button>span,.team-person-preview{animation:none;transition:none}}
`

function PersonBox({ person, tone, roleLabel }: { person: Person; tone?: string; roleLabel?: string }) {
  const accent = tone ?? 'var(--border)'
  const sub = roleLabel ?? (person.dept_role ? ROLE_LABEL[person.dept_role] : person.is_section_head ? 'หัวหน้างาน' : (person.position_title ?? person.role ?? ''))
  return <PersonPreview name={person.name} photo={person.photo} accent={accent} sub={sub} />
}

async function canManageTeamOrg() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return canManagePersonnel(normalizeRole(actor?.role))
}

export default async function TeamOrgPage() {
  const canManage = await canManageTeamOrg()
  const [{ data: profileData }, { data: groupData }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, name, name_prefix, dept, dept_role, is_section_head, team_org_visible, position_title, role, avatar_url, official_photo_url').eq('status', 'active').is('deleted_at', null).order('name'),
    supabaseAdmin.from('personnel_work_groups').select('id, name, depts').order('created_at', { ascending: true }),
  ])
  const raw = profileData ?? []
  const photos = await Promise.all(raw.map((p) => (p.official_photo_url ? createStaffSignedUrl(p.official_photo_url) : Promise.resolve(null))))
  const people: Person[] = raw.map((p, i) => ({
    id: p.id, name: formatProfileName(p.name, p.name_prefix), dept: p.dept, dept_role: p.dept_role, is_section_head: p.is_section_head ?? false, team_org_visible: p.team_org_visible !== false,
    position_title: p.position_title, role: p.role, photo: photos[i] ?? p.avatar_url ?? null,
  }))
  const groups = (groupData ?? []) as WorkGroup[]

  const chartPeople = people.filter((p) => p.team_org_visible && p.dept)
  const groupLeads = chartPeople.filter((p) => p.dept_role === 'group_lead')
  const groupDeputies = chartPeople.filter((p) => p.dept_role === 'group_deputy')

  // A section = one or more งาน displayed together. heads = anyone flagged หัวหน้างาน
  // (incl. a รองหัวหน้ากลุ่มงาน who also leads their งาน); members = the rest of the งาน.
  const sectionFrom = (depts: string[]) => ({
    heads: chartPeople.filter((p) => p.dept && depts.includes(p.dept) && p.is_section_head),
    members: chartPeople.filter((p) => p.dept && depts.includes(p.dept) && !p.is_section_head && p.dept_role == null),
  })
  const inGroup = new Set(groups.flatMap((g) => g.depts))
  const groupSections = groups.map((g) => ({ id: `group:${g.id}`, title: g.name ?? g.depts.join(' และ '), depts: g.depts, ...sectionFrom(g.depts) }))
  const standaloneSections = DEPARTMENTS.filter((d) => !inGroup.has(d)).map((d) => ({ id: `dept:${d}`, title: d, depts: [d], ...sectionFrom([d]) }))
  const allSections = [...groupSections, ...standaloneSections]
  const sections = allSections.filter((s) => s.heads.length > 0 || s.members.length > 0)
  const displaySections = canManage ? allSections : sections
  const assignmentPeople: TeamOrgAssignmentPerson[] = people.map(({ id, name, dept, position_title, dept_role, is_section_head, team_org_visible }) => ({
    id, name, dept, position_title, dept_role, is_section_head, team_org_visible,
  }))
  const assignmentSections: TeamOrgAssignmentSection[] = allSections.map(({ id, title, depts }) => ({ id, title, depts }))

  const connector = <div style={{ width: 2, height: 18, background: 'var(--border)', margin: '0 auto' }} />

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`${CSS}
        .team-org-wrapper { max-width: 1700px; margin: 0 auto; padding: 36px 28px 64px; }
        @media (max-width: 768px) { .team-org-wrapper { padding: 20px 16px 48px; } }
      `}</style>
      <div className="team-org-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <PageHeader eyebrow="กลุ่มงานเทคนิคการแพทย์" title="เจ้าหน้าที่กลุ่มงานเทคนิคการแพทย์" subtitle="ตามหัวหน้างานและบุคลากรในแต่ละงาน" marginBottom={0} />
          {canManage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <TeamOrgAssignmentButton people={assignmentPeople} sections={assignmentSections} />
              <Link href="/staff/personnel/manage" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, boxSizing: 'border-box', padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <Icon name="settings" size={15} /> จัดการกลุ่มงาน
              </Link>
            </div>
          )}
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
          {displaySections.map((s, i) => (
            <div key={s.id} className="to-rise" style={{ ...card, animationDelay: `${i * 45}ms` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div className="team-section-title" style={{ marginBottom: 0 }}>{s.title}</div>
                {canManage && <TeamOrgAssignmentButton people={assignmentPeople} sections={assignmentSections} initialSectionId={s.id} label="เพิ่มคน" />}
              </div>
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
              {s.heads.length === 0 && s.members.length === 0 && (
                <div style={{ padding: '16px 10px', borderRadius: 9, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>ยังไม่มีบุคลากรในกล่องนี้</div>
              )}
            </div>
          ))}
        </div>
        {sections.length === 0 && groupLeads.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>ยังไม่มีบุคลากร — กำหนดหัวหน้างานได้ที่หน้า “จัดการกลุ่มงาน”</div>
        )}
      </div>
    </main>
  )
}
