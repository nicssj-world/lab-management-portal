import type { CertificateUrgency, OutlabCertificateLifecycle, OutlabSector } from './domain'
import type { ExternalQualityCatalogTest, ExternalQualityPerson } from '@/lib/external-quality/server'

export type OutlabFile = {
  id: string
  certificate_id: string
  r2_key: string
  file_name: string
  content_type: string
  size_bytes: number
  uploaded_at: string
  uploaded_by: string
}

export type OutlabCertificate = {
  id: string
  laboratory_id: string
  standard_name: string
  accreditation_body: string | null
  certificate_no: string | null
  scope: string | null
  valid_from: string | null
  expires_on: string
  lifecycle: OutlabCertificateLifecycle
  supersedes_id: string | null
  remark: string | null
  urgency: CertificateUrgency
  files: OutlabFile[]
}

export type OutlabLaboratory = {
  id: string
  sector: OutlabSector
  name: string
  brand: string | null
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  public_accreditation_summary: string | null
  active: boolean
  publish_public: boolean
  remark: string | null
  ownerIds: string[]
  primaryOwnerId: string | null
  certificates: OutlabCertificate[]
}

export type OutlabService = {
  id: string
  laboratory_id: string
  test_id: number | null
  manual_test_name: string | null
  test_name_snapshot: string
  external_code: string | null
  method: string | null
  specimen: string | null
  transport_condition: string | null
  tat_text: string | null
  price: number | null
  is_primary: boolean
  active: boolean
  remark: string | null
}

export type OutlabOverview = {
  laboratories: OutlabLaboratory[]
  services: OutlabService[]
  people: ExternalQualityPerson[]
  tests: ExternalQualityCatalogTest[]
  summary: { laboratories: number; services: number; expiring: number; expired: number; missingCurrentCertificate: number }
}
