import { renderSatisfactionSection } from '../page'

export const dynamic = 'force-dynamic'

export default async function SatisfactionSurveysPage() {
  return renderSatisfactionSection('surveys')
}
