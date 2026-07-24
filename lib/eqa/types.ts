import type { EqaDeadlineUrgency, EqaRoundStatus } from './domain'
import type { EqaAnalyzer, ExternalQualityCatalogTest, ExternalQualityPerson } from '@/lib/external-quality/server'

export type EqaCatalogCategory = {
  id: string
  th: string
  sort_order: number
}

export type EqaOverview = {
  providers: Record<string, any>[]
  programs: Record<string, any>[]
  programTests: Record<string, any>[]
  coverageRequirements: Record<string, any>[]
  rounds: Array<Record<string, any> & { urgency: EqaDeadlineUrgency; blockers: string[]; status: EqaRoundStatus }>
  results: Record<string, any>[]
  capas: Record<string, any>[]
  attachments: Record<string, any>[]
  capaLinks: Record<string, any>[]
  people: ExternalQualityPerson[]
  responsiblePeople: ExternalQualityPerson[]
  tests: ExternalQualityCatalogTest[]
  analyzers: EqaAnalyzer[]
  categories: EqaCatalogCategory[]
  coverageSummary: { eligible: number; planned: number; completed: number; plannedPct: number; completedPct: number }
  summary: { activePrograms: number; urgentRounds: number; unacceptableResults: number; openCapas: number }
}
