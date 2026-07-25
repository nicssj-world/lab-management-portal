import { z } from 'zod'
import {
  HEAD_CONTACT_CATEGORIES,
  HEAD_CONTACT_CONTACT_MAX,
  HEAD_CONTACT_DETAIL_MAX,
  HEAD_CONTACT_NAME_MAX,
  HEAD_CONTACT_STATUSES,
} from '@/lib/head-contact/constants'

const trimmedOptional = (max: number) => z.string().trim().max(max).optional().default('')

export const HeadContactPublicSubmissionSchema = z.object({
  submissionKey: z.string().uuid(),
  challenge: z.string().min(40).max(2_048),
  website: z.string().max(200).optional().default(''),
  form: z.object({
    sender_name: trimmedOptional(HEAD_CONTACT_NAME_MAX),
    contact_channel: trimmedOptional(HEAD_CONTACT_CONTACT_MAX),
    service_unit_id: z.string().min(1).max(100),
    service_unit_name: z.string().trim().max(HEAD_CONTACT_NAME_MAX).optional().default(''),
    other_service_unit: z.string().trim().max(HEAD_CONTACT_NAME_MAX).optional().default(''),
    category: z.enum(HEAD_CONTACT_CATEGORIES),
    detail: z.string().trim().min(1).max(HEAD_CONTACT_DETAIL_MAX),
    wants_reply: z.boolean(),
  }),
})

export const HeadContactUpdateSchema = z.object({
  status: z.enum(HEAD_CONTACT_STATUSES).optional(),
  action_note: z.string().trim().max(HEAD_CONTACT_DETAIL_MAX).nullable().optional(),
  contacted_at: z.string().datetime({ offset: true }).nullable().optional(),
  contact_note: z.string().trim().max(2_000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'ไม่มีข้อมูลที่ต้องแก้ไข' })

export const HeadContactSettingsSchema = z.object({
  is_open: z.boolean().optional(),
  rotateToken: z.literal(true).optional(),
}).refine((value) => value.is_open !== undefined || value.rotateToken === true, { message: 'ไม่มีข้อมูลที่ต้องแก้ไข' })

export const HeadContactUnitCreateSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อหน่วย').max(HEAD_CONTACT_NAME_MAX),
})

export const HeadContactUnitUpdateSchema = z.object({
  name: z.string().trim().min(1).max(HEAD_CONTACT_NAME_MAX).optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).max(10_000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'ไม่มีข้อมูลที่ต้องแก้ไข' })
