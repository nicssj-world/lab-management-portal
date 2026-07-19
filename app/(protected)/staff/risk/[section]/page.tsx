import { notFound } from 'next/navigation'
import type { RiskSection } from '@/components/risk/RiskClient'
import { renderRiskSection } from '../page'

const SECTIONS: Record<string, RiskSection> = {
  ior: 'ior',
  register: 'register',
  'smart-rm': 'smart',
}

export default async function RiskSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const activeSection = SECTIONS[section]
  if (!activeSection) notFound()
  return renderRiskSection(activeSection)
}
