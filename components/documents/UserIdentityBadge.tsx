// Shared "who's logged in" pill shown in the header of every เอกสารคุณภาพ sub-page
// (คลังเอกสาร, แดชบอร์ด, Master List, หมวดหมู่, รออนุมัติ, รายงานการอ่าน), so identity is
// visible consistently no matter which module the user is on.
const DOC_ROLE_COLOR: Record<string, { bg: string; color: string; dot: string }> = {
  'Laboratory Director': { bg: 'rgba(30,95,173,.09)',  color: '#1E5FAD', dot: '#1E5FAD' },
  'Quality Manager':     { bg: 'rgba(13,148,136,.09)', color: '#0D9488', dot: '#0D9488' },
  'Document Controller': { bg: 'rgba(147,51,234,.09)', color: '#9333EA', dot: '#9333EA' },
  'Reviewer':            { bg: 'rgba(217,119,6,.09)',  color: '#B45309', dot: '#D97706' },
  'Viewer':              { bg: 'rgba(100,116,139,.09)',color: '#64748B', dot: '#94A3B8' },
}

export function UserIdentityBadge({ userName, docRole, userRole }: { userName?: string; docRole?: string; userRole?: string }) {
  if (!userName && !docRole) return null
  const scheme = docRole ? DOC_ROLE_COLOR[docRole] : undefined
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 12px', borderRadius: 10,
      background: scheme?.bg ?? 'var(--surface-2)',
      border: `1px solid ${scheme ? scheme.color + '33' : 'var(--border)'}`,
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: scheme?.dot ?? 'var(--muted)',
        boxShadow: scheme ? `0 0 0 2px ${scheme.dot}33` : 'none',
      }} />
      <div>
        {userName && (
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            {userName}
          </div>
        )}
        <div style={{ fontSize: 11, color: scheme?.color ?? 'var(--muted)', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
          {docRole ?? userRole ?? 'Staff'}
        </div>
      </div>
    </div>
  )
}
