import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { unexpectedError } from '@/lib/chemical-safety/api'
import { getChemicalSafetyDashboard } from '@/lib/chemical-safety/repository'

export async function GET(_request: NextRequest) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  try { return NextResponse.json({ data: await getChemicalSafetyDashboard() }) } catch (error) { return unexpectedError(error) }
}
