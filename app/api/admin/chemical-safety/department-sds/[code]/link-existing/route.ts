import { NextResponse } from 'next/server'

/**
 * The old "match a PDF to an existing holding" workflow is intentionally
 * closed. Department SDS files now enter the registry through the SDS-only
 * path, and registry-created SDS drafts are managed from the chemical record.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'department_sds_link_existing_closed' },
    { status: 410 },
  )
}
