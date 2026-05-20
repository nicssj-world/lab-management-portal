import { createClient } from '@/lib/supabase/server'
import { DocumentsClient } from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  return <DocumentsClient userRole={actor?.role ?? undefined} />
}
