import { supabaseAdmin } from '@/lib/supabase/admin'
import { bangkokToday, listExternalQualityCatalogTests, listExternalQualityPeople } from '@/lib/external-quality/server'
import { certificateUrgency, type OutlabCertificateLifecycle } from './domain'
import type { OutlabCertificate, OutlabFile, OutlabLaboratory, OutlabOverview, OutlabService } from './types'

type Row = Record<string, any>

export async function getOutlabOverview(today = bangkokToday()): Promise<OutlabOverview> {
  const [labsResult, ownersResult, servicesResult, certsResult, filesResult, people, tests] = await Promise.all([
    supabaseAdmin.from('outlab_laboratories').select('*').order('name'),
    supabaseAdmin.from('outlab_laboratory_owners').select('*'),
    supabaseAdmin.from('outlab_services').select('*').order('test_name_snapshot'),
    supabaseAdmin.from('outlab_certificates').select('*').order('expires_on'),
    supabaseAdmin.from('outlab_certificate_files').select('*').order('uploaded_at'),
    listExternalQualityPeople(),
    listExternalQualityCatalogTests(),
  ])
  for (const result of [labsResult, ownersResult, servicesResult, certsResult, filesResult]) {
    if (result.error) throw result.error
  }

  const filesByCert = new Map<string, OutlabFile[]>()
  for (const row of (filesResult.data ?? []) as Row[]) {
    const file = row as OutlabFile
    filesByCert.set(file.certificate_id, [...(filesByCert.get(file.certificate_id) ?? []), file])
  }
  const certsByLab = new Map<string, OutlabCertificate[]>()
  for (const row of (certsResult.data ?? []) as Row[]) {
    const certificate = {
      ...row,
      urgency: certificateUrgency(row.expires_on, row.lifecycle as OutlabCertificateLifecycle, today),
      files: filesByCert.get(row.id) ?? [],
    } as OutlabCertificate
    certsByLab.set(certificate.laboratory_id, [...(certsByLab.get(certificate.laboratory_id) ?? []), certificate])
  }
  const ownersByLab = new Map<string, Row[]>()
  for (const row of (ownersResult.data ?? []) as Row[]) {
    ownersByLab.set(row.laboratory_id, [...(ownersByLab.get(row.laboratory_id) ?? []), row])
  }
  const laboratories = ((labsResult.data ?? []) as Row[]).map(row => {
    const owners = ownersByLab.get(row.id) ?? []
    return {
      ...row,
      ownerIds: owners.map(owner => String(owner.user_id)),
      primaryOwnerId: owners.find(owner => owner.owner_role === 'primary')?.user_id ?? null,
      certificates: certsByLab.get(row.id) ?? [],
    } as OutlabLaboratory
  })
  const services = (servicesResult.data ?? []) as OutlabService[]
  const currentCerts = laboratories.flatMap(lab => lab.certificates.filter(cert => cert.lifecycle === 'current'))
  const expiring = currentCerts.filter(cert => ['watch', 'urgent', 'critical'].includes(cert.urgency)).length
  const expired = currentCerts.filter(cert => cert.urgency === 'expired').length
  const missingCurrentCertificate = laboratories.filter(lab => lab.active && !lab.certificates.some(cert => cert.lifecycle === 'current')).length
  return {
    laboratories, services, people, tests,
    summary: {
      laboratories: laboratories.filter(lab => lab.active).length,
      services: services.filter(service => service.active).length,
      expiring, expired, missingCurrentCertificate,
    },
  }
}

export async function getPublicOutlabPartners() {
  const { data: labs, error } = await supabaseAdmin
    .from('outlab_laboratories')
    .select('id, sector, name, brand, public_accreditation_summary')
    .eq('active', true)
    .eq('publish_public', true)
    .order('name')
  if (error) throw error
  const ids = (labs ?? []).map(row => row.id)
  const { data: certs } = ids.length
    ? await supabaseAdmin.from('outlab_certificates').select('laboratory_id, standard_name').in('laboratory_id', ids).eq('lifecycle', 'current')
    : { data: [] }
  return (labs ?? []).map(lab => ({
    sector: lab.sector,
    name: lab.name,
    brand: lab.brand ?? '',
    accred: (certs ?? []).filter(cert => cert.laboratory_id === lab.id).map(cert => cert.standard_name).join(', ') || lab.public_accreditation_summary || 'อยู่ระหว่างปรับปรุงข้อมูล',
  }))
}

