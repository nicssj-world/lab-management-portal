// SERVER ONLY — ดึงข้อมูลเครื่องมือสำหรับหน้า public (สแกน QR) โดย whitelist คอลัมน์
// จงใจไม่ดึง purchase_price / created_by / เอกสาร QC ภายใน — หน้านี้เปิดสาธารณะ ไม่ต้อง login
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import type { Equipment } from '@/lib/queries/equipment'

// คอลัมน์ที่ยอมให้ปรากฏบนหน้า public — แหล่งความจริงเดียวของ "อะไรเปิดเผยได้"
const PUBLIC_COLUMNS = [
  'id', 'cbh_code', 'equipment_type', 'department', 'hospital_asset_no',
  'classification', 'responsible_person', 'owner', 'owner_status',
  'manufacturer', 'model', 'serial_number', 'vendor',
  'purchase_date', 'warranty_exp', 'status', 'risk_level',
  'needs_calibration', 'purpose', 'remark', 'photo_url', 'manual_url',
  'pm_cal_data',
].join(', ')

export interface PublicEquipment {
  id: string
  cbh_code: string | null
  equipment_type: string
  department: string
  hospital_asset_no: string | null
  classification: string | null
  responsible_person: string | null
  owner: string | null
  owner_status: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  vendor: string | null
  purchase_date: string | null
  warranty_exp: string | null
  status: Equipment['status']
  risk_level: Equipment['risk_level']
  needs_calibration: boolean
  purpose: string | null
  remark: string | null
  cal: {
    last_pm_date: string | null
    last_cal_date: string | null
    certificate_no: string | null
    cal_result: string | null
  }
  photoSignedUrl: string | null
  manualSignedUrl: string | null
}

async function signR2(key: string | null): Promise<string | null> {
  if (!key) return null
  try {
    return await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 3600 })
  } catch {
    return null
  }
}

export async function getPublicEquipment(id: string): Promise<PublicEquipment | null> {
  const { data, error } = await supabaseAdmin
    .from('equipment')
    .select(PUBLIC_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  const row = data as unknown as Equipment

  const [photoSignedUrl, manualSignedUrl] = await Promise.all([
    signR2(row.photo_url),
    signR2(row.manual_url),
  ])

  return {
    id: row.id,
    cbh_code: row.cbh_code,
    equipment_type: row.equipment_type,
    department: row.department,
    hospital_asset_no: row.hospital_asset_no,
    classification: row.classification,
    responsible_person: row.responsible_person,
    owner: row.owner,
    owner_status: row.owner_status,
    manufacturer: row.manufacturer,
    model: row.model,
    serial_number: row.serial_number,
    vendor: row.vendor,
    purchase_date: row.purchase_date,
    warranty_exp: row.warranty_exp,
    status: row.status,
    risk_level: row.risk_level,
    needs_calibration: row.needs_calibration,
    purpose: row.purpose,
    remark: row.remark,
    cal: {
      last_pm_date: row.pm_cal_data?.last_pm_date ?? null,
      last_cal_date: row.pm_cal_data?.last_cal_date ?? null,
      certificate_no: row.pm_cal_data?.certificate_no ?? null,
      cal_result: row.pm_cal_data?.cal_result ?? null,
    },
    photoSignedUrl,
    manualSignedUrl,
  }
}
