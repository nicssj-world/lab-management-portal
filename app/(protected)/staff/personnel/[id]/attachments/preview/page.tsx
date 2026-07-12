import { redirect } from 'next/navigation'
import { PdfViewer } from '@/components/documents/PdfViewer'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { staffFileTypeForPath } from '@/lib/personnel/storage'

function isImage(contentType: string) {
  return contentType.startsWith('image/')
}

function isPdf(contentType: string) {
  return contentType === 'application/pdf'
}

export default async function PersonnelAttachmentPreviewPage(ctx: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ path?: string }>
}) {
  const [{ id }, searchParams] = await Promise.all([ctx.params, ctx.searchParams])
  const path = searchParams.path
  if (!path) redirect(`/staff/personnel/${id}`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const fileUrl = `/api/admin/personnel/${id}/files?path=${encodeURIComponent(path)}&inline=1`
  const contentType = staffFileTypeForPath(path)
  const fileName = path.split('/').pop() ?? 'attachment'

  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)', padding: 16 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Preview</div>
            <h1 style={{
              margin: 0,
              fontSize: 15,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {fileName}
            </h1>
          </div>
          <a
            href={fileUrl}
            style={{
              flexShrink: 0,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--primary)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            เปิดไฟล์ในหน้านี้
          </a>
        </header>

        <section style={{
          minHeight: 'calc(100vh - 100px)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)',
          overflow: 'hidden',
        }}>
          {isImage(contentType) ? (
            <div style={{ minHeight: 'calc(100vh - 100px)', display: 'grid', placeItems: 'center', padding: 16 }}>
              <img src={fileUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 132px)', objectFit: 'contain' }} />
            </div>
          ) : isPdf(contentType) ? (
            <div style={{ height: 'calc(100vh - 100px)' }}>
              <PdfViewer url={fileUrl} fileName={fileName} mimeType={contentType} />
            </div>
          ) : (
            <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>
              ไม่รองรับการพรีวิวไฟล์ชนิดนี้ กรุณากดเปิดไฟล์ในหน้านี้
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
