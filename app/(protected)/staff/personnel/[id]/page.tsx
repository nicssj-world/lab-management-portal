import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { getStaffDetail } from '@/lib/queries/personnel'
import { createStaffSignedUrl } from '@/lib/personnel/storage'
import { StaffDetailClient, type TestOption, type StaffOption } from './StaffDetailClient'

export default async function StaffDetailPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none' && user.id !== id) redirect('/staff/dashboard')
  const canEdit = perms['บุคลากร'] === 'edit' || user.id === id

  const detail = await getStaffDetail(id)
  if (!detail) notFound()

  const [{ data: tests }, { data: cats }, { data: staff }] = await Promise.all([
    supabaseAdmin.from('tests').select('id, code, th, category_id').eq('active', true).order('th'),
    supabaseAdmin.from('categories').select('id, th').order('th'),
    supabaseAdmin.from('profiles').select('id, name').is('deleted_at', null).order('name'),
  ])

  const testOptions: TestOption[] = (tests ?? []).map((t) => ({ id: t.id, code: t.code, th: t.th, category_id: t.category_id }))
  const categories: string[] = (cats ?? []).map((c) => c.th)
  const staffOptions: StaffOption[] = (staff ?? []).map((s) => ({ id: s.id, name: s.name }))
  const officialPhotoUrl = await createStaffSignedUrl(detail.profile.official_photo_url)

  return (
    <StaffDetailClient
      detail={detail}
      canEdit={canEdit}
      tests={testOptions}
      categories={categories}
      staff={staffOptions}
      officialPhotoUrl={officialPhotoUrl}
    />
  )
}
