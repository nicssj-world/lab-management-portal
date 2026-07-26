import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { queryObject, unexpectedError, validationError } from '@/lib/chemical-safety/api'
import { listInternalSds } from '@/lib/chemical-safety/repository'
import { internalSdsQuerySchema } from '@/lib/chemical-safety/schemas'

export async function GET(request: NextRequest){const guard=await requireChemicalViewer();if(guard.response)return guard.response;const parsed=internalSdsQuerySchema.safeParse(queryObject(request.nextUrl.searchParams));if(!parsed.success)return validationError(parsed.error);try{return NextResponse.json({items:await listInternalSds(parsed.data)})}catch(error){return unexpectedError(error)}}
