import { redirect } from 'next/navigation'

export default async function SdsManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  redirect(`/staff/lab-map/chemicals?view=${view === 'departments' ? 'sds-departments' : 'sds-chemicals'}`)
}
