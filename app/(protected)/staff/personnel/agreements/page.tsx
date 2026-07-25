import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/roles'
import { canApproveAgreementCampaign, canManageAgreementCampaigns, canViewAgreementCampaigns } from '@/lib/personnel/agreement-access'
import { listAgreementCampaigns } from '@/lib/personnel/annual-agreements-server'
import { AgreementCampaignManagerClient } from '@/components/personnel/AgreementCampaignManagerClient'

export default async function AgreementCampaignManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role, dept_role').eq('id', user.id).single()
  const role = normalizeRole(actor?.role)
  const canManageCampaigns = canManageAgreementCampaigns(role)
  const canApproveCampaigns = canApproveAgreementCampaign(actor?.dept_role)
  if (!canViewAgreementCampaigns(role, actor?.dept_role)) redirect('/staff/personnel')
  const documentsPromise = canManageCampaigns
    ? supabaseAdmin.from('documents').select('id, document_code, title, revision').is('deleted_at', null).eq('status', 'Published').order('document_code')
    : Promise.resolve({ data: [] })
  const [campaigns, docsResult] = await Promise.all([
    listAgreementCampaigns(),
    documentsPromise,
  ])
  return <AgreementCampaignManagerClient
    initialCampaigns={campaigns}
    documents={docsResult.data ?? []}
    canManageCampaigns={canManageCampaigns}
    canApproveCampaigns={canApproveCampaigns}
  />
}
