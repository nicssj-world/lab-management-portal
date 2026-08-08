import { z } from 'zod'

// ── Definition (stored in competency_exams.definition JSONB) ──
export type ExamImage = { id: string; key: string; alt: string; width: number; height: number }
export type ExamImageView = ExamImage & { url?: string }
export type ExamOption = { id: string; label: string; isCorrect: boolean; images?: ExamImage[] }
export type ExamQuestion = { id: string; prompt: string; type: 'single_choice' | 'yes_no'; options: ExamOption[]; images?: ExamImage[] }
// authorizeCategory: when set, passing the exam auto-grants a performer authorization for that หมวด.
export type ExamDefinition = { questions: ExamQuestion[]; authorizeCategory?: string | null }
export type ExamOptionView = Omit<ExamOption, 'images'> & { images: ExamImageView[] }
export type ExamQuestionView = Omit<ExamQuestion, 'images' | 'options'> & { images: ExamImageView[]; options: ExamOptionView[] }
export type ExamDefinitionView = Omit<ExamDefinition, 'questions'> & { questions: ExamQuestionView[] }

export type CompetencyExam = {
  id: string
  title: string
  description: string | null
  definition: ExamDefinition
  pass_mark: number
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ExamAssignment = {
  id: string
  exam_id: string
  profile_id: string
  assigned_by: string | null
  status: 'open' | 'submitted' | 'graded'
  score: number | null
  passed: boolean | null
  answers: Record<string, string> | null
  competency_id: string | null
  assigned_at: string
  submitted_at: string | null
}

// ── Validation ──
const ExamImageSchema = z.object({
  id: z.string().min(1).max(120),
  key: z.string().min(1).max(500),
  alt: z.string().max(300),
  width: z.number().int().positive().max(1600),
  height: z.number().int().positive().max(1600),
})
const ExamImagesSchema = z.array(ExamImageSchema).max(4, 'แนบรูปได้ไม่เกิน 4 รูป').default([])
const ExamOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().max(500),
  isCorrect: z.boolean(),
  images: ExamImagesSchema,
}).refine((o) => Boolean(o.label) || o.images.length > 0, { path: ['label'], message: 'กรุณากรอกตัวเลือกหรือแนบรูป' })
const ExamQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().trim().max(1000),
  type: z.enum(['single_choice', 'yes_no']),
  options: z.array(ExamOptionSchema).min(2, 'ต้องมีอย่างน้อย 2 ตัวเลือก').max(10),
  images: ExamImagesSchema,
}).refine((q) => Boolean(q.prompt) || q.images.length > 0, { path: ['prompt'], message: 'กรุณากรอกคำถามหรือแนบรูป' })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, { path: ['options'], message: 'ต้องเลือกเฉลยถูกต้องเพียงหนึ่งข้อในแต่ละคำถาม' })

export const ExamDefinitionSchema = z.object({
  questions: z.array(ExamQuestionSchema).min(1, 'ต้องมีอย่างน้อยหนึ่งคำถาม'),
  authorizeCategory: z.string().trim().max(300).nullable().optional(),
})

export const ExamUpsertSchema = z.object({
  title: z.string().trim().min(1, 'กรุณากรอกชื่อข้อสอบ').max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  definition: ExamDefinitionSchema,
  passMark: z.number().min(0).max(100),
})
export type ExamUpsertInput = z.infer<typeof ExamUpsertSchema>

export function normalizeExamDefinition(definition: ExamDefinition): ExamDefinition {
  return {
    ...definition,
    questions: (definition.questions ?? []).map((q) => ({
      ...q,
      images: q.images ?? [],
      options: (q.options ?? []).map((o) => ({ ...o, images: o.images ?? [] })),
    })),
  }
}

export function stripExamImageRuntimeUrls(definition: ExamDefinitionView): ExamDefinition {
  return {
    ...definition,
    questions: definition.questions.map((q) => ({
      ...q,
      images: q.images.map(({ url: _url, ...image }) => image),
      options: q.options.map((o) => ({
        ...o,
        images: o.images.map(({ url: _optionUrl, ...image }) => image),
      })),
    })),
  }
}

export const ExamAssignSchema = z.object({
  profileIds: z.array(z.string().uuid()).min(1, 'เลือกบุคลากรอย่างน้อยหนึ่งคน'),
})

export const ExamSubmitSchema = z.object({
  answers: z.record(z.string(), z.string()),
})

// ── Auto-grade against the answer key ──
export function gradeExam(definition: ExamDefinition, answers: Record<string, string>, passMark: number) {
  const questions = definition.questions ?? []
  const total = questions.length
  let correct = 0
  for (const q of questions) {
    const chosen = answers[q.id]
    if (!chosen) continue
    const option = q.options.find((o) => o.id === chosen)
    if (option?.isCorrect) correct++
  }
  const score = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0
  return { correct, total, score, passed: score >= passMark }
}

// Strip the answer key for the take-exam view (respondent must not see isCorrect).
export function definitionForTaking(definition: ExamDefinition): ExamDefinition {
  return {
    questions: (definition.questions ?? []).map((q) => ({
      ...q,
      images: q.images ?? [],
      options: q.options.map((o) => ({ ...o, isCorrect: false, images: o.images ?? [] })),
    })),
  }
}
