import { Icon } from '@/components/ui/Icon'
import { OrgViewer } from './OrgViewer'

// Resolved org node (display name + signed photo already computed server-side)
export interface OrgNode {
  id: string
  parent_id: string | null
  title: string
  node_type: 'leadership' | 'position' | 'unit'
  display_name: string | null
  position: string | null
  photo: string | null
  photo_position: string | null
  phone: string | null
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
const splitPhones = (phone: string): string[] => phone.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
// Prefer the phone stored on the node; fall back to the title map only when it's blank.
const resolvePhones = (node: { phone: string | null; title: string }): string[] =>
  node.phone?.trim() ? splitPhones(node.phone) : (PHONE_LOOKUP.get(norm(node.title)) ?? [])

// Thai has no spaces between words, so browsers break long labels mid-word.
// Segment into words and join with zero-width spaces → breaks only at word boundaries.
type Segmenter = { segment(s: string): Iterable<{ segment: string }> }
const SegmenterCtor = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => Segmenter }).Segmenter
const thaiSeg: Segmenter | null = SegmenterCtor ? new SegmenterCtor('th', { granularity: 'word' }) : null
const ZWSP = String.fromCharCode(0x200B)
// Compound technical terms the ICU dictionary over-segments — keep them unbroken.
const KEEP_TOGETHER = ['จุลทรรศนศาสตร์', 'จุลชีววิทยา', 'ปฏิบัติการ']
const KEEP_RE = KEEP_TOGETHER.map((t) => new RegExp([...t].join(`${ZWSP}?`), 'g'))
function thaiWords(text: string): string[] {
  if (!thaiSeg) return [text]
  let out = ''
  for (const { segment } of thaiSeg.segment(text)) out += segment + ZWSP
  KEEP_RE.forEach((re, i) => { out = out.replace(re, KEEP_TOGETHER[i]) })
  return out.split(ZWSP).filter(Boolean)
}

// Render Thai text wrapping only at word boundaries. `word-break: keep-all` does NOT
// work for Thai (spec: CJK only), so instead each word is an atomic `nowrap` span and
// ZWSP between words provides the (only) break opportunities.
function ThaiLabel({ text, style }: { text: string; style: React.CSSProperties }) {
  const words = thaiWords(text)
  const parts: React.ReactNode[] = []
  words.forEach((w, i) => {
    if (i > 0) parts.push(ZWSP)
    parts.push(<span key={i} style={{ whiteSpace: 'nowrap' }}>{w}</span>)
  })
  return <div lang="th" style={style}>{parts}</div>
}

const TREE_CSS = `
.octree { --org-line: #94A3B8; padding: 6px 0; }
[data-theme="dark"] .octree { --org-line: #64748B; }
.octree ul { position: relative; padding-top: 16px; display: flex; justify-content: center; margin: 0; }
.octree > ul { padding-top: 0; }
.octree li { list-style: none; position: relative; padding: 16px 5px 0; display: flex; flex-direction: column; align-items: center; }
.octree li::before, .octree li::after {
  content: ''; position: absolute; top: 0; right: 50%;
  border-top: 2px solid var(--org-line); width: 50%; height: 16px;
}
.octree li::after { right: auto; left: 50%; border-left: 2px solid var(--org-line); }
.octree li:only-child::after, .octree li:only-child::before { display: none; }
.octree li:only-child { padding-top: 0; }
.octree li:first-child::before, .octree li:last-child::after { border: 0 none; }
.octree li:last-child::before { border-right: 2px solid var(--org-line); border-radius: 0 6px 0 0; }
.octree li:first-child::after { border-radius: 6px 0 0 0; }
.octree ul ul::before {
  content: ''; position: absolute; top: 0; left: 50%;
  border-left: 2px solid var(--org-line); width: 0; height: 16px;
}
.org-phone {
  display: inline-block; font-family: "IBM Plex Mono", monospace;
  font-size: 11px; font-weight: 700; color: var(--primary);
  background: var(--primary-soft); border: 1px solid rgba(30,95,173,.2);
  border-radius: 20px; padding: 1px 9px;
}
.org-clickable { border-radius: 12px; transition: background .15s; }
.org-clickable:hover { background: var(--surface-2); }
.org-expand-hint {
  position: absolute; top: 8px; right: 10px; display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 11px; border-radius: 20px; background: var(--card); border: 1px solid var(--border);
  font-size: 11.5px; font-weight: 600; color: var(--muted); pointer-events: none;
  box-shadow: 0 1px 4px rgba(0,0,0,.08); transition: color .15s, border-color .15s;
}
.org-clickable:hover .org-expand-hint { color: var(--primary); border-color: var(--primary); }
`

// Vertical padding is '11px 11px 16px' (top+bottom = 27). The box's min-height is driven
// by --org-box-h, a CSS variable OrgViewer sets client-side after measuring the tallest
// box's natural content — this string is identical on server and client (no hydration risk).
function NodeBox({ node }: { node: OrgNode }) {
  const accent = node.node_type === 'leadership' ? '#64748B' : node.node_type === 'position' ? 'var(--primary)' : '#0D9488'
  const phones = resolvePhones(node)
  return (
    <div style={{ width: 220, minHeight: 'calc(var(--org-box-h, 0px) + 27px)', boxSizing: 'border-box', background: 'var(--card)', border: '1px solid var(--border)', borderTop: `3px solid ${accent}`, borderRadius: 12, padding: '11px 11px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div data-org-inner style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 176, height: 176, borderRadius: 9, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
          {node.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={node.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: node.photo_position ?? '50% 50%' }} />
            : <Icon name="users" size={36} style={{ color: 'var(--muted)' }} />}
        </div>
        {/* ตำแหน่ง / หน่วยงาน */}
        <ThaiLabel text={node.title} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.3 }} />
        {/* ชื่อบุคคล */}
        {node.display_name
          ? <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.35 }}>{node.display_name}</div>
          : null}
        {/* ตำแหน่ง (จากโปรไฟล์ที่ link) */}
        {node.position
          ? <ThaiLabel text={node.position} style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.3 }} />
          : null}
        {/* เบอร์โทรภายใน */}
        {phones.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 1 }}>
            {phones.map((p) => <span key={p} className="org-phone">{p}</span>)}
          </div>
        )}
      </div>
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
      <OrgViewer>
        <div className="octree"><ul>{roots.map(renderNode)}</ul></div>
      </OrgViewer>
    </>
  )
}
