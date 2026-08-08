import type { NextRequest } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { parseJson, queryObject, unexpectedError, validationError } from '@/lib/chemical-safety/api'
import { exportResponse } from '@/lib/external-quality/export'
import { buildChemicalRegistryExcel } from '@/lib/chemical-safety/registry-excel'
import { buildChemicalRegistryPdf } from '@/lib/chemical-safety/registry-pdf'
import { listChemicalRegistry } from '@/lib/chemical-safety/repository'
import { chemicalRegistryExportRequestSchema, chemicalRegistryFiltersSchema } from '@/lib/chemical-safety/schemas'
import { formatChemicalRegistryScopeLabel, toChemicalExportRows, toChemicalPdfRows } from '@/lib/chemical-safety/export-rows'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ChemicalRegistryFilters } from '@/lib/chemical-safety/types'

export const runtime = 'nodejs'

type RegistryExportFormat = 'pdf' | 'xlsx'

async function buildRegistryExport(input: {
  actorId: string
  format: RegistryExportFormat
  filters: ChemicalRegistryFilters
  newChemicalHoldingIds: string[]
}) {
  const rows = await listChemicalRegistry(input.filters)
  const exportRows = toChemicalExportRows(rows, new Set(input.newChemicalHoldingIds))
  const showPdfGroupRows = !input.filters.unitId && !input.filters.roomId
  const pdfRows = toChemicalPdfRows(rows, new Set(input.newChemicalHoldingIds), showPdfGroupRows)
  const now = new Date()
  const date = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(now)
  const generated = new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(now)
  const bytes = input.format === 'xlsx'
    ? await buildChemicalRegistryExcel(exportRows)
    : buildChemicalRegistryPdf({
      rows: pdfRows,
      scopeLabel: formatChemicalRegistryScopeLabel(input.filters, rows),
      asOfDate: date,
      generatedAt: generated,
      showGroupRows: showPdfGroupRows,
    })
  const extension = input.format === 'xlsx' ? 'xlsx' : 'pdf'
  const action = input.format === 'xlsx' ? 'chemical_safety.registry.export_excel' : 'chemical_safety.registry.export_pdf'
  const audit = await supabaseAdmin.from('audit_log').insert({
    action,
    user_id: input.actorId,
    target: 'chemical-registry',
    detail: JSON.stringify({
      format: input.format,
      filters: input.filters,
      count: rows.length,
      highlightedCount: exportRows.filter(row => row.highlighted).length,
      generatedAt: now.toISOString(),
    }),
  })
  if (audit.error) throw audit.error

  return exportResponse(
    bytes,
    `chemical-inventory-${now.toISOString().slice(0, 10)}.${extension}`,
    input.format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf',
  )
}

export async function GET(request: NextRequest) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  const parsed = chemicalRegistryFiltersSchema.safeParse(queryObject(request.nextUrl.searchParams))
  if (!parsed.success) return validationError(parsed.error)
  try {
    return await buildRegistryExport({
      actorId: guard.actor.id,
      format: 'pdf',
      filters: parsed.data,
      newChemicalHoldingIds: [],
    })
  } catch (error) {
    return unexpectedError(error)
  }
}

export async function POST(request: Request) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  const parsed = await parseJson(request, chemicalRegistryExportRequestSchema)
  if (parsed.response) return parsed.response
  try {
    return await buildRegistryExport({
      actorId: guard.actor.id,
      format: parsed.data.format,
      filters: parsed.data.filters,
      newChemicalHoldingIds: parsed.data.newChemicalHoldingIds,
    })
  } catch (error) {
    return unexpectedError(error)
  }
}
