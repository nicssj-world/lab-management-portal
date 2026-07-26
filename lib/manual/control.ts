import { z } from 'zod'

export interface ManualPublication {
  id: 'main'
  document_code: string
  revision: string
  revision_date: string | null
  effective_date: string | null
  reviewed_at: string | null
  revised_by_name: string | null
  approved_by_name: string | null
  updated_at: string | null
}

export interface ManualPublicationRevision {
  id: number
  revision: string
  revision_date: string | null
  effective_date: string | null
  change_summary: string
  revised_by_name: string | null
  approved_by_name: string | null
  source_document: string | null
}

export interface ManualSectionControl {
  owner_name_th: string | null
  owner_name_en: string | null
  revision_no: number
  last_change_summary: string | null
  updated_at: string | null
}

export interface ManualSectionDraft {
  body_html_th: string
  body_html_en: string
  table_data: Record<string, unknown[]> | null
  owner_name_th: string | null
  owner_name_en: string | null
  updated_at: string | null
}

export interface ManualSectionRevision {
  id: number
  section_id: string
  revision_no: number
  change_summary: string
  owner_name_th: string | null
  owner_name_en: string | null
  changed_at: string
  changed_by_name: string | null
}

export const DEFAULT_MANUAL_PUBLICATION: ManualPublication = {
  id: 'main',
  document_code: 'MN-LAB-01',
  revision: '13',
  revision_date: null,
  effective_date: null,
  reviewed_at: null,
  revised_by_name: null,
  approved_by_name: null,
  updated_at: null,
}

export const DEFAULT_SECTION_OWNERS: Record<string, { th: string; en: string }> = {
  home: { th: 'กลุ่มงานเทคนิคการแพทย์', en: 'Medical Technology Department' },
  collection: { th: 'กลุ่มงานเทคนิคการแพทย์', en: 'Medical Technology Department' },
  transport: { th: 'กลุ่มงานเทคนิคการแพทย์', en: 'Medical Technology Department' },
  addon: { th: 'กลุ่มงานเทคนิคการแพทย์', en: 'Medical Technology Department' },
  report: { th: 'กลุ่มงานเทคนิคการแพทย์', en: 'Medical Technology Department' },
  outlab: { th: 'งานตรวจพิเศษและปฏิบัติการตรวจต่อ', en: 'Special Testing and Referral Laboratory' },
  micro: { th: 'งานจุลชีววิทยาคลินิก', en: 'Clinical Microbiology' },
  bloodbank: { th: 'งานคลังเลือด', en: 'Blood Bank' },
  amendment: { th: 'กลุ่มงานเทคนิคการแพทย์', en: 'Medical Technology Department' },
}

const nullableDate = z.preprocess(
  value => value === '' || value === undefined ? null : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
)

const nullableShortText = (max: number) => z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().trim().max(max).nullable(),
)

export const manualPublicationInputSchema = z.object({
  document_code: z.string().trim().min(1).max(80),
  revision: z.string().trim().min(1).max(40),
  revision_date: nullableDate,
  effective_date: nullableDate,
  // Kept for backwards-compatible API requests, but ignored by the route.
  // The value is derived from the latest edited manual section.
  reviewed_at: nullableDate.optional(),
  revised_by_name: nullableShortText(200),
  approved_by_name: nullableShortText(200),
}).strict()

export const manualSectionPatchSchema = z.object({
  body_html_th: z.string().max(1_000_000).optional(),
  body_html_en: z.string().max(1_000_000).optional(),
  table_data: z.record(z.string(), z.array(z.record(z.string(), z.unknown())).max(2_000)).optional(),
  owner_name_th: nullableShortText(200).optional(),
  owner_name_en: nullableShortText(200).optional(),
  change_summary: z.string().trim().max(500).optional(),
}).strict()

export const publishManualSectionSchema = z.object({
  change_summary: z.string().trim().min(1, 'กรุณาระบุสรุปการเปลี่ยนแปลงก่อนเผยแพร่').max(500),
}).strict()
