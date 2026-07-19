import { notFound } from 'next/navigation'
import type { OutlabSection } from '@/components/outlab/OutlabDashboard'
import { renderOutlabSection } from '../page'

export const dynamic = 'force-dynamic'

const SECTIONS: Record<string, OutlabSection> = {
  laboratories: 'laboratories',
  services: 'services',
  certificates: 'certificates',
  settings: 'settings',
}

export default async function OutlabSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const activeSection = SECTIONS[section]
  if (!activeSection) notFound()
  return renderOutlabSection(activeSection)
}
