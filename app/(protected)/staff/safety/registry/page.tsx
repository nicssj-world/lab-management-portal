import { redirect } from 'next/navigation'
import { requireSafetyViewer, isSafetyEditor } from '@/lib/lab-map/safety-access'
import { getQualityTaskTemplates, listTaskPeople } from '@/lib/quality-tasks/server'
import { SafetyTaskRegistry } from '@/components/safety-tasks/SafetyTaskRegistry'

export const dynamic = 'force-dynamic'

export default async function SafetyTaskRegistryPage() {
  const guarded = await requireSafetyViewer()
  if (guarded.response) redirect('/login')
  const editor = await isSafetyEditor(guarded.actor)
  if (!editor) redirect('/staff/safety')
  const [templates, people] = await Promise.all([getQualityTaskTemplates(false, 'safety'), listTaskPeople()])
  return <SafetyTaskRegistry initialTemplates={templates} people={people as { id: string; name: string; dept: string | null; role: string; position_title: string | null }[]} />
}
