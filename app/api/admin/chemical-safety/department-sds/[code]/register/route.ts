import { NextResponse, type NextRequest } from 'next/server'

/**
 * The former department-chemical change-request endpoint is intentionally
 * closed. Department SDS now enters the current registry through the
 * register-sds-only endpoint, and quantity is completed later from the
 * registry when it becomes known.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: 'department_sds_creation_closed' }, { status: 410 })
}
