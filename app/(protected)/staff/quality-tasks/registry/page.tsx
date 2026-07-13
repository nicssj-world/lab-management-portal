import { redirect } from 'next/navigation'
import { getActor, getPermissionLevel } from '@/lib/auth/guards'
import { getQualityTaskTemplates, listTaskPeople } from '@/lib/quality-tasks/server'
import { QualityTaskRegistry } from '@/components/quality-tasks/QualityTaskRegistry'

export const dynamic = 'force-dynamic'

export default async function QualityTaskRegistryPage() {
  const actor=await getActor(); if(!actor)redirect('/login')
  const level=await getPermissionLevel(actor,'งานคุณภาพ'); if(level==='none')redirect('/staff/dashboard')
  const [templates,people]=await Promise.all([getQualityTaskTemplates(),listTaskPeople()])
  return <QualityTaskRegistry level={level} initialTemplates={templates} people={people as {id:string;name:string;dept:string|null;role:string;document_position:string|null}[]}/>
}

