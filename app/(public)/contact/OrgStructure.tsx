import { Icon } from '@/components/ui/Icon'

// Resolved org node (display name + signed photo already computed server-side)
export interface OrgNode {
  id: string
  parent_id: string | null
  title: string
  node_type: 'leadership' | 'position' | 'unit'
  display_name: string | null
  photo: string | null
  sort_order: number
}

// Internal extensions keyed by org-node title.
// org_chart_nodes has no phone column, so we map from the lab's known directory.
// (เก็บไว้ที่นี่จุดเดียว — แก้เบอร์ของหน่วยงานได้ที่ map นี้)
const UNIT_PHONES: Record<string, string[]> = {
  'หัวหน้ากลุ่มงานเทคนิคการแพทย์': ['1453'],
  'รองหัวหน้ากลุ่มงานเทคนิคการแพทย์': ['1464', '1469'],
  'งานคลังเลือด': ['1458'],
  'งานตรวจพิเศษ และห้องปฏิบัติการตรวจต่อ': ['1452', '1461', '1467'],
  'งานบริการผู้ป่วยนอก': ['1606-07'],
  'ห้องปฏิบัติการ ศสม.เมืองชลบุรี': ['1633-4'],
  'งานจุลชีววิทยาคลินิก และคลังน้ำยา': ['1462-63'],
  'งานบริการทั่วไป': ['1455'],
  'ห้องปฏิบัติการเคมีคลินิกและภูมิคุ้มกันวิทยาคลินิก': ['1464', '1469'],
  'ห้องปฏิบัติการโลหิตวิทยาคลินิกและจุลทรรศนศาสตร์คลินิก': ['1465-66', '1468'],
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const PHONE_LOOKUP = new Map(Object.entries(UNIT_PHONES).map(([k, v]) => [norm(k), v]))
const lookupPhones = (title: string): string[] => PHONE_LOOKUP.get(norm(title)) ?? []

const TREE_CSS = `
.octree { padding: 16px 0; overflow-x: auto; }
.octree ul { position: relative; padding-top: 22px; display: flex; justify-content: center; margin: 0; }
.octree > ul { padding-top: 0; }
.octree li { list-style: none; position: relative; padding: 22px 10px 0; display: flex; flex-direction: column; align-items: center; }
.octree li::before, .octree li::after {
  content: ''; position: absolute; top: 0; right: 50%;
  border-top: 1.5px solid var(--border); width: 50%; height: 22px;
}
.octree li::after { right: auto; left: 50%; border-left: 1.5px solid var(--border); }
.octree li:only-child::after, .octree li:only-child::before { display: none; }
.octree li:only-child { padding-top: 0; }
.octree li:first-child::before, .octree li:last-child::after { border: 0 none; }
.octree li:last-child::before { border-right: 1.5px solid var(--border); border-radius: 0 6px 0 0; }
.octree li:first-child::after { border-radius: 6px 0 0 0; }
.octree ul ul::before {
  content: ''; position: absolute; top: 0; left: 50%;
  border-left: 1.5px solid var(--border); width: 0; height: 22px;
}
.org-phone {
  display: inline-block; font-family: "IBM Plex Mono", monospace;
  font-size: 11px; font-weight: 700; color: var(--primary);
  background: var(--primary-soft); border: 1px solid rgba(30,95,173,.2);
  border-radius: 20px; padding: 1px 9px;
}
`

function NodeBox({ node }: { node: OrgNode }) {
  const accent = node.node_type === 'leadership' ? '#64748B' : node.node_type === 'position' ? 'var(--primary)' : '#0D9488'
  const phones = lookupPhones(node.title)
  return (
    <div style={{ width: 192, background: 'var(--card)', border: '1px solid var(--border)', borderTop: `3px solid ${accent}`, borderRadius: 12, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
        {node.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={node.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icon name="users" size={22} style={{ color: 'var(--muted)' }} />}
      </div>
      {/* ตำแหน่ง / หน่วยงาน */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.3 }}>{node.title}</div>
      {/* ชื่อบุคคล */}
      {node.display_name
        ? <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.35 }}>{node.display_name}</div>
        : null}
      {/* เบอร์โทรภายใน */}
      {phones.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 1 }}>
          {phones.map((p) => <span key={p} className="org-phone">{p}</span>)}
        </div>
      )}
    </div>
  )
}

export function OrgStructure({ nodes }: { nodes: OrgNode[] }) {
  const childrenOf = new Map<string | null, OrgNode[]>()
  for (const n of nodes) {
    const k = n.parent_id
    childrenOf.set(k, [...(childrenOf.get(k) ?? []), n])
  }
  for (const arr of childrenOf.values()) arr.sort((a, b) => a.sort_order - b.sort_order)
  const roots = childrenOf.get(null) ?? []

  const renderNode = (n: OrgNode): React.ReactNode => {
    const kids = childrenOf.get(n.id) ?? []
    return (
      <li key={n.id}>
        <NodeBox node={n} />
        {kids.length > 0 && <ul>{kids.map(renderNode)}</ul>}
      </li>
    )
  }

  if (roots.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
        ยังไม่มีข้อมูลผังโครงสร้างองค์กร
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TREE_CSS }} />
      <div className="octree"><ul>{roots.map(renderNode)}</ul></div>
    </>
  )
}
