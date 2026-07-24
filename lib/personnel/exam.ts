import { z } from 'zod'

// ── Definition (stored in competency_exams.definition JSONB) ──
export type ExamOption = { id: string; label: string; isCorrect: boolean }
export type ExamQuestion = { id: string; prompt: string; type: 'single_choice' | 'yes_no'; options: ExamOption[] }
export type ExamDefinition = { questions: ExamQuestion[] }

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
const ExamOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, 'กรุณากรอกตัวเลือก').max(500),
  isCorrect: z.boolean(),
})
const ExamQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().trim().min(1, 'กรุณากรอกคำถาม').max(1000),
  type: z.enum(['single_choice', 'yes_no']),
  options: z.array(ExamOptionSchema).min(2, 'ต้องมีอย่างน้อย 2 ตัวเลือก').max(10),
}).refine((q) => q.options.some((o) => o.isCorrect), { message: 'ต้องเลือกเฉลยอย่างน้อยหนึ่งข้อในแต่ละคำถาม' })

export const ExamDefinitionSchema = z.object({
  questions: z.array(ExamQuestionSchema).min(1, 'ต้องมีอย่างน้อยหนึ่งคำถาม'),
})

export const ExamUpsertSchema = z.object({
  title: z.string().trim().min(1, 'กรุณากรอกชื่อข้อสอบ').max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  definition: ExamDefinitionSchema,
  passMark: z.number().min(0).max(100),
})
export type ExamUpsertInput = z.infer<typeof ExamUpsertSchema>

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
      options: q.options.map((o) => ({ id: o.id, label: o.label, isCorrect: false })),
    })),
  }
}
