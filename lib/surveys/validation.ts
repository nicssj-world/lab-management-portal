import type {
  NormalizedSurveyAnswer,
  SubmissionValidationIssue,
  SubmissionValidationResult,
  SurveyAnswerInput,
  SurveyQuestion,
  SurveyVersionDefinition,
} from './types'

const MAX_PAYLOAD_BYTES = 64 * 1024
const MAX_SHORT_TEXT = 500
const MAX_LONG_TEXT = 4_000

const trimmedOrNull = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const hasAnswerValue = (answer: SurveyAnswerInput | undefined) =>
  Boolean(
    answer &&
      (answer.optionId ||
        answer.textValue?.trim() ||
        answer.detailText?.trim() ||
        answer.numericValue !== null && answer.numericValue !== undefined),
  )

function textLimitFor(question: SurveyQuestion) {
  if (question.type === 'long_text') {
    return Math.min(question.maxLength ?? MAX_LONG_TEXT, MAX_LONG_TEXT)
  }
  if (question.type === 'short_text') {
    return Math.min(question.maxLength ?? MAX_SHORT_TEXT, MAX_SHORT_TEXT)
  }
  return MAX_SHORT_TEXT
}

export function validateSubmission(
  definition: SurveyVersionDefinition,
  answers: ReadonlyArray<SurveyAnswerInput>,
): SubmissionValidationResult {
  const issues: SubmissionValidationIssue[] = []

  if (new TextEncoder().encode(JSON.stringify(answers)).byteLength > MAX_PAYLOAD_BYTES) {
    issues.push({ message: 'ข้อมูลคำตอบต้องมีขนาดไม่เกิน 64 KiB' })
  }

  const questions = definition.sections.flatMap((section) => section.questions)
  const questionById = new Map(questions.map((question) => [question.id, question]))
  const answerByQuestion = new Map<string, SurveyAnswerInput>()

  answers.forEach((answer) => {
    if (!questionById.has(answer.questionId)) {
      issues.push({ questionId: answer.questionId, message: 'ไม่พบคำถามนี้ในแบบสำรวจ' })
      return
    }
    if (answerByQuestion.has(answer.questionId)) {
      issues.push({ questionId: answer.questionId, message: 'ส่งคำตอบของคำถามเดิมซ้ำ' })
      return
    }
    answerByQuestion.set(answer.questionId, answer)
  })

  const normalized: NormalizedSurveyAnswer[] = []

  questions.forEach((question) => {
    const answer = answerByQuestion.get(question.id)
    if (!hasAnswerValue(answer)) {
      if (question.required) {
        issues.push({ questionId: question.id, message: 'คำถามนี้จำเป็นต้องตอบ' })
      }
      return
    }

    const base: NormalizedSurveyAnswer = {
      questionId: question.id,
      sectionId: question.sectionId,
      optionId: null,
      numericValue: null,
      textValue: null,
      detailText: null,
      score: null,
      maxScore: null,
      positiveThreshold: null,
      isComment: Boolean(question.isComment),
    }

    if (question.type === 'single_choice' || question.type === 'rating_scale') {
      const option = question.options.find((candidate) => candidate.id === answer?.optionId)
      if (!option) {
        issues.push({ questionId: question.id, message: 'ตัวเลือกไม่อยู่ในคำถามนี้' })
        return
      }

      const otherText = trimmedOrNull(answer?.textValue)
      if (option.allowsOtherText && !otherText) {
        issues.push({ questionId: question.id, message: 'โปรดระบุรายละเอียดของตัวเลือกอื่น ๆ' })
        return
      }
      if (otherText && otherText.length > MAX_SHORT_TEXT) {
        issues.push({ questionId: question.id, message: 'ข้อความต้องไม่เกิน 500 ตัวอักษร' })
        return
      }

      const detailText = trimmedOrNull(answer?.detailText)
      if (detailText && detailText.length > MAX_SHORT_TEXT) {
        issues.push({ questionId: question.id, message: 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร' })
        return
      }
      if (detailText && question.type === 'rating_scale' && !question.allowDetailText) {
        issues.push({ questionId: question.id, message: 'คำถามนี้ไม่รองรับรายละเอียดเพิ่มเติม' })
        return
      }

      const scoredOptions = question.options
        .map((candidate) => candidate.score)
        .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))

      normalized.push({
        ...base,
        optionId: option.id,
        textValue: otherText,
        detailText,
        score: typeof option.score === 'number' && Number.isFinite(option.score) ? option.score : null,
        maxScore: scoredOptions.length > 0 ? Math.max(...scoredOptions) : null,
        positiveThreshold:
          question.type === 'rating_scale' ? question.positiveThreshold : null,
      })
      return
    }

    if (question.type === 'number') {
      const value = answer?.numericValue
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ questionId: question.id, message: 'กรุณากรอกตัวเลขที่ถูกต้อง' })
        return
      }
      if (value < question.min || value > question.max) {
        issues.push({
          questionId: question.id,
          message: `ค่าต้องอยู่ระหว่าง ${question.min} ถึง ${question.max}`,
        })
        return
      }
      normalized.push({ ...base, numericValue: value })
      return
    }

    if (question.type === 'short_text' || question.type === 'long_text') {
      const textValue = trimmedOrNull(answer?.textValue)
      const maxLength = textLimitFor(question)
      if (!textValue) {
        if (question.required) {
          issues.push({ questionId: question.id, message: 'คำถามนี้จำเป็นต้องตอบ' })
        }
        return
      }
      if (textValue.length > maxLength) {
        issues.push({
          questionId: question.id,
          message:
            maxLength === MAX_LONG_TEXT
              ? 'ข้อความต้องไม่เกิน 4,000 ตัวอักษร'
              : `ข้อความต้องไม่เกิน ${maxLength.toLocaleString('en-US')} ตัวอักษร`,
        })
        return
      }
      normalized.push({ ...base, textValue })
      return
    }

    const yesNoOptions = question.options ?? []
    const option = yesNoOptions.find((candidate) => candidate.id === answer?.optionId)
    if (!option) {
      issues.push({ questionId: question.id, message: 'กรุณาเลือกใช่หรือไม่ใช่' })
      return
    }
    normalized.push({
      ...base,
      optionId: option.id,
      score: typeof option.score === 'number' && Number.isFinite(option.score) ? option.score : null,
    })
  })

  return issues.length > 0 ? { ok: false, issues } : { ok: true, answers: normalized }
}
