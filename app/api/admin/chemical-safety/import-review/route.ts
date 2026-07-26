import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { queryObject, unexpectedError, validationError } from '@/lib/chemical-safety/api'
import { listChemicalImportReview } from '@/lib/chemical-safety/repository'
import { chemicalImportReviewQuerySchema } from '@/lib/chemical-safety/schemas'

export async function GET(request: NextRequest) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  const parsed = chemicalImportReviewQuerySchema.safeParse(queryObject(request.nextUrl.searchParams))
  if (!parsed.success) return validationError(parsed.error)
  try { return NextResponse.json({ items: await listChemicalImportReview(parsed.data) }) } catch (error) { return unexpectedError(error) }
}
