import { z } from 'zod'
import { SURVEY_QUESTION_TYPES } from './types'

export const surveyOptionSchema = z.object({
  id: z.string().uuid(),
  optionKey: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(500),
  value: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().positive(),
  score: z.number().finite().nullable().optional(),
  allowsOtherText: z.boolean().optional(),
})

export const surveyQuestionSchema = z.object({
  id: z.string().uuid(),
  questionKey: z.string().trim().min(1).max(100),
  sectionId: z.string().uuid(),
  prompt: z.string().max(1_000),
  type: z.enum(SURVEY_QUESTION_TYPES),
  required: z.boolean(),
  sortOrder: z.number().int().positive(),
  helpText: z.string().max(1_000).nullable().optional(),
  isComment: z.boolean().optional(),
  options: z.array(surveyOptionSchema).max(20).optional(),
  maxLength: z.number().int().positive().max(4_000).optional(),
  placeholder: z.string().max(500).nullable().optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  positiveThreshold: z.number().finite().optional(),
  allowDetailText: z.boolean().optional(),
  detailLabel: z.string().max(500).nullable().optional(),
})

export const surveyDefinitionSchema = z.object({
  id: z.string().uuid(),
  surveyId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  title: z.string().max(500),
  description: z.string().max(4_000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  publishedAt: z.string().datetime().nullable().optional(),
  sections: z.array(z.object({
    id: z.string().uuid(),
    sectionKey: z.string().trim().min(1).max(100),
    title: z.string().max(500),
    description: z.string().max(2_000).nullable().optional(),
    sortOrder: z.number().int().positive(),
    questions: z.array(surveyQuestionSchema).max(100),
  })).max(30),
})

export const createSurveySchema = z.object({
  code: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(4_000).nullable().optional(),
})

export const archiveSurveySchema = z.object({ archived: z.boolean() })
export const draftMutationSchema = z.object({ definition: surveyDefinitionSchema })
export const cloneDraftSchema = z.object({ sourceVersionId: z.string().uuid() })
export const discardDraftSchema = z.object({ versionId: z.string().uuid() })
export const publishSurveySchema = z.object({ versionId: z.string().uuid() })

export const createCampaignSchema = z.object({
  surveyId: z.string().uuid(),
  surveyVersionId: z.string().uuid(),
  name: z.string().trim().min(1).max(500),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  responseLimit: z.number().int().positive().max(1_000_000).nullable().optional(),
  onePerDevice: z.boolean().default(false),
})

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(),
  status: z.enum(['draft', 'open', 'closed']).optional(),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  responseLimit: z.number().int().positive().max(1_000_000).nullable().optional(),
  onePerDevice: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'ไม่มีข้อมูลที่ต้องแก้ไข')

export const rotateCampaignTokenSchema = z.object({ confirm: z.literal(true) })
export const publicSubmissionSchema = z.object({
  submissionKey: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid().nullable().optional(),
    numericValue: z.number().finite().nullable().optional(),
    textValue: z.string().nullable().optional(),
    detailText: z.string().nullable().optional(),
  })).max(500),
})
