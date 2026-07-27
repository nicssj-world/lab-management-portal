import { NextResponse } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { unexpectedError } from '@/lib/chemical-safety/api'
import { listDepartmentSds } from '@/lib/chemical-safety/department-repository'

export async function GET() {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  try {
    return NextResponse.json({ groups: await listDepartmentSds() })
  } catch (error) {
    return unexpectedError(error)
  }
}
