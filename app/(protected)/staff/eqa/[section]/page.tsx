import { notFound } from 'next/navigation'
import type { EqaSection } from '@/components/eqa/EqaDashboard'
import { renderEqaSection } from '../page'

export const dynamic = 'force-dynamic'

const SECTIONS: Record<string, EqaSection> = {
  programs: 'programs',
  rounds: 'rounds',
  coverage: 'coverage',
  capa: 'capa',
  settings: 'settings',
}

export default async function EqaSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ fiscalYearBe?: string }> }) {
  const { section } = await params
  const activeSection = SECTIONS[section]
  if (!activeSection) notFound()
  return renderEqaSection(activeSection, searchParams)
}
