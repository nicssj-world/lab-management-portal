import { renderSatisfactionSection } from '../page'

export const dynamic = 'force-dynamic'

export default async function SatisfactionCommentsPage() {
  return renderSatisfactionSection('comments')
}
