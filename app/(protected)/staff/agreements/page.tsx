import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnnualAgreementsClient } from '@/components/personnel/AnnualAgreementsClient'

export default async function AnnualAgreementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AnnualAgreementsClient />
}
