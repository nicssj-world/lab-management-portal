import { z } from 'zod'

// Icons offered in the section icon picker. Every value must exist as a key in the
// ICONS map in components/ui/Icon.tsx — keep in sync when adding one here.
export const SECTION_ICONS = [
  'doc', 'book', 'clipboard', 'inbox', 'flask', 'beaker', 'microscope',
  'blood', 'droplet', 'dna', 'petri', 'syringe', 'pill', 'shieldCheck',
  'users', 'building', 'globe', 'chart', 'clock', 'alert', 'sparkle',
] as const

export const SECTION_GROUP_BY = ['department', 'type'] as const

export const SectionSettingsSchema = z.object({
  group_by: z.enum(SECTION_GROUP_BY).default('department'),
  hidden_groups: z.array(z.string()).default([]),
  group_titles: z.record(z.string()).default({}),
})

export const SectionCreateSchema = z.object({
  title_th: z.string().min(1, 'กรุณากรอกชื่อหัวข้อ').max(120),
  title_en: z.string().max(120).default(''),
  description_th: z.string().max(500).nullable().optional(),
  description_en: z.string().max(500).nullable().optional(),
  icon: z.enum(SECTION_ICONS).default('doc'),
})

export const SectionUpdateSchema = z.object({
  title_th: z.string().min(1).max(120).optional(),
  title_en: z.string().max(120).optional(),
  description_th: z.string().max(500).nullable().optional(),
  description_en: z.string().max(500).nullable().optional(),
  icon: z.enum(SECTION_ICONS).optional(),
  visible: z.boolean().optional(),
  default_expanded: z.boolean().optional(),
  hot: z.boolean().optional(),
  settings: SectionSettingsSchema.optional(),
})

export const SectionReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

// Section members are polymorphic — exactly one source key per item.
export const SectionItemSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('library'),
    document_id: z.string().uuid(),
    label_override: z.string().max(200).nullable().optional(),
  }),
  z.object({
    source: z.literal('test_attachment'),
    test_document_id: z.number().int().positive(),
    label_override: z.string().max(200).nullable().optional(),
  }),
  z.object({
    source: z.literal('upload'),
    upload_id: z.string().uuid(),
    label_override: z.string().max(200).nullable().optional(),
  }),
])

export const SectionItemsSchema = z.object({
  items: z.array(SectionItemSchema).max(200),
})

export type SectionIcon = typeof SECTION_ICONS[number]
export type SectionGroupBy = typeof SECTION_GROUP_BY[number]
export type SectionItemInput = z.infer<typeof SectionItemSchema>
export type SectionSettings = z.infer<typeof SectionSettingsSchema>
