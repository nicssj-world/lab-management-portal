import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { queryObject, unexpectedError, validationError } from '@/lib/chemical-safety/api'
import { getChemicalStorageLayout } from '@/lib/chemical-safety/repository'

const querySchema = z.object({ roomCode: z.string().trim().min(1).max(50).default('chemical-prep') })

export async function GET(request: NextRequest) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  const parsed = querySchema.safeParse(queryObject(request.nextUrl.searchParams))
  if (!parsed.success) return validationError(parsed.error)
  try { return NextResponse.json({ items: await getChemicalStorageLayout(parsed.data.roomCode) }) } catch (error) { return unexpectedError(error) }
}
