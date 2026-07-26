import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { GhsPictogramCode } from './types'
import type { PublicSdsFile, PublicSdsFilters, PublicSdsResult } from './public-types'

type Row = Record<string, any>

async function rows(table: string, configure?: (query: any) => any): Promise<Row[]> {
  let query: any = (supabaseAdmin.from(table) as any).select('*')
  if (configure) query = configure(query)
  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return data ?? []
}

async function loadPublicRows() {
  const [products, aliases, unitProducts, units, versions] = await Promise.all([
    rows('chemical_products', query => query.eq('lifecycle_status', 'active')),
    rows('chemical_product_aliases'),
    rows('chemical_unit_products', query => query.eq('active', true).eq('public_eligible', true)),
    rows('chemical_units', query => query.eq('active', true)),
    rows('chemical_sds_versions', query => query.eq('status', 'approved')),
  ])
  return { products, aliases, unitProducts, units, versions }
}

export async function searchPublicSds(filters: PublicSdsFilters = {}): Promise<PublicSdsResult[]> {
  const data = await loadPublicRows()
  const aliasByProduct = new Map<string, string[]>()
  for (const alias of data.aliases) aliasByProduct.set(alias.product_id, [...(aliasByProduct.get(alias.product_id) ?? []), String(alias.alias)])
  const unitById = new Map(data.units.map(unit => [unit.id, unit]))
  const publishedUnits = new Map<string, Array<{ code: string; name: string }>>()
  for (const link of data.unitProducts) {
    const unit = unitById.get(link.unit_id)
    if (!unit) continue
    const values = publishedUnits.get(link.product_id) ?? []
    if (!values.some(item => item.code === unit.code)) values.push({ code: String(unit.code), name: String(unit.name_th) })
    publishedUnits.set(link.product_id, values)
  }
  const versionByProduct = new Map(data.versions.map(version => [version.product_id, version]))
  const results: PublicSdsResult[] = []
  for (const product of data.products) {
    const version = versionByProduct.get(product.id)
    const units = publishedUnits.get(product.id) ?? []
    if (!version || units.length === 0) continue
    const aliases = aliasByProduct.get(product.id) ?? []
    const pictograms = Array.isArray(version.pictogram_codes) ? version.pictogram_codes as GhsPictogramCode[] : []
    const statements = Array.isArray(version.h_statements) ? version.h_statements.filter((item: any) => item && typeof item.code === 'string' && typeof item.text === 'string') : []
    const publicId = String(product.public_id)
    const item: PublicSdsResult = {
      publicId,
      canonicalName: String(product.canonical_name),
      aliases,
      casNumber: product.cas_number ?? null,
      concentration: version.concentration ?? product.concentration ?? null,
      manufacturer: version.manufacturer ?? product.manufacturer ?? null,
      supplier: version.supplier ?? product.supplier ?? null,
      productCode: version.product_code ?? product.product_code ?? null,
      units: units.sort((a, b) => a.name.localeCompare(b.name, 'th')),
      language: version.language || 'th',
      revisionLabel: version.revision_label ?? null,
      effectiveOn: version.effective_on ?? null,
      signalWord: version.signal_word ?? null,
      pictogramCodes: pictograms,
      hCodes: statements.map((statement: any) => statement.code),
      hazardStatements: statements,
      sourceUrl: version.source_url ?? null,
      viewUrl: `/api/public/sds/${publicId}/file?disposition=inline`,
      downloadUrl: `/api/public/sds/${publicId}/file?disposition=attachment`,
    }
    const haystack = JSON.stringify([item.canonicalName, item.aliases, item.casNumber, item.manufacturer, item.supplier, item.units]).toLocaleLowerCase('th')
    if (filters.q && !haystack.includes(filters.q.toLocaleLowerCase('th'))) continue
    if (filters.unit && !item.units.some(unit => unit.code === filters.unit || unit.name === filters.unit)) continue
    if (filters.language && item.language !== filters.language) continue
    if (filters.ghs && !item.pictogramCodes.includes(filters.ghs)) continue
    if (filters.productIds && !filters.productIds.includes(publicId)) continue
    results.push(item)
  }
  return results.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'th'))
}

export async function getPublicSdsFile(publicId: string): Promise<PublicSdsFile | null> {
  const { data: product } = await supabaseAdmin.from('chemical_products').select('id').eq('public_id', publicId).eq('lifecycle_status', 'active').maybeSingle()
  if (!product) return null
  const { data: links } = await supabaseAdmin.from('chemical_unit_products').select('unit_id').eq('product_id', product.id).eq('active', true).eq('public_eligible', true)
  if (!links?.length) return null
  const { data: version } = await supabaseAdmin.from('chemical_sds_versions').select('file_id').eq('product_id', product.id).eq('status', 'approved').maybeSingle()
  if (!version?.file_id) return null
  const { data: file } = await supabaseAdmin.from('chemical_sds_files').select('r2_key, file_name, content_type').eq('id', version.file_id).maybeSingle()
  if (!file || file.content_type !== 'application/pdf') return null
  return { r2Key: file.r2_key, fileName: file.file_name, contentType: 'application/pdf' }
}
