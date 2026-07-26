import { redirect } from 'next/navigation'
import { SdsManagementClient } from '@/components/chemical-safety/SdsManagementClient'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { listInternalSds } from '@/lib/chemical-safety/repository'

export const dynamic = 'force-dynamic'
export default async function SdsManagementPage(){const guard=await requireChemicalViewer();if(guard.response)redirect('/login');return <SdsManagementClient items={await listInternalSds()}/>}
