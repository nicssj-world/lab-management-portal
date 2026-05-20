import { createClient } from '@/lib/supabase/server'
import { MasterListClient } from './MasterListClient'

export default async function MasterListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  return <MasterListClient userRole={actor?.role ?? undefined} />
}
