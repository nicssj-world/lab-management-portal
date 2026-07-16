import type {
  SurveyQuestion,
  SurveyVersionDefinition,
  SurveyVersionStatus,
} from './types'

export type DefinitionIssue = {
  path: string
  message: string
}

const newId = () => globalThis.crypto.randomUUID()

export function assertCanCreateDraft(
  versions: ReadonlyArray<{ id: string; status: SurveyVersionStatus }>,
) {
  if (versions.some((version) => version.status === 'draft')) {
    throw new Error('แบบสำรวจนี้มีฉบับร่างอยู่แล้ว กรุณาแก้ไขหรือเผยแพร่ฉบับเดิมก่อน')
  }
}

export function cloneDefinition(
  source: SurveyVersionDefinition,
  nextVersion: number,
): SurveyVersionDefinition {
  if (!Number.isInteger(nextVersion) || nextVersion <= source.versionNumber) {
    throw new Error('หมายเลขเวอร์ชันใหม่ต้องมากกว่าเวอร์ชันต้นฉบับ')
  }

  const sections = source.sections.map((section) => {
    const sectionId = newId()
    const questions = section.questions.map((question) => {
      const base = {
        ...question,
        id: newId(),
        sectionId,
      }
      if (
        question.type === 'single_choice' ||
        question.type === 'rating_scale' ||
        question.type === 'yes_no'
      ) {
        return {
          ...base,
          options: question.options?.map((option) => ({ ...option, id: newId() })),
        } as SurveyQuestion
      }
      return base as SurveyQuestion
    })
    return { ...section, id: sectionId, questions }
  })

  return {
    ...source,
    id: newId(),
    versionNumber: nextVersion,
    status: 'draft',
    publishedAt: null,
    sections,
  }
}

const add = (issues: DefinitionIssue[], path: string, message: string) => {
  issues.push({ path, message })
}

export function validateDefinitionForPublish(
  definition: SurveyVersionDefinition,
): DefinitionIssue[] {
  const issues: DefinitionIssue[] = []

  if (!definition.title.trim()) add(issues, 'title', 'กรุณาระบุชื่อแบบสำรวจ')
  if (definition.sections.length === 0) {
    add(issues, 'sections', 'แบบสำรวจต้องมีอย่างน้อย 1 ส่วน')
    return issues
  }

  const sectionKeys = new Set<string>()
  const questionKeys = new Set<string>()

  definition.sections.forEach((section, sectionIndex) => {
    const sectionPath = `sections.${sectionIndex}`
    if (!section.title.trim()) add(issues, `${sectionPath}.title`, 'กรุณาระบุชื่อส่วน')
    if (!section.sectionKey.trim() || sectionKeys.has(section.sectionKey)) {
      add(issues, `${sectionPath}.sectionKey`, 'รหัสส่วนต้องไม่ว่างและไม่ซ้ำ')
    }
    sectionKeys.add(section.sectionKey)

    if (section.questions.length === 0) {
      add(issues, `${sectionPath}.questions`, 'แต่ละส่วนต้องมีอย่างน้อย 1 คำถาม')
    }

    section.questions.forEach((question, questionIndex) => {
      const path = `${sectionPath}.questions.${questionIndex}`
      if (!question.prompt.trim()) add(issues, `${path}.prompt`, 'กรุณาระบุคำถาม')
      if (!question.questionKey.trim() || questionKeys.has(question.questionKey)) {
        add(issues, `${path}.questionKey`, 'รหัสคำถามต้องไม่ว่างและไม่ซ้ำ')
      }
      questionKeys.add(question.questionKey)

      if (question.type === 'single_choice' || question.type === 'rating_scale') {
        if (question.options.length < 2) {
          add(issues, `${path}.options`, 'คำถามแบบตัวเลือกต้องมีอย่างน้อย 2 ตัวเลือก')
        }
        const optionKeys = new Set<string>()
        question.options.forEach((option, optionIndex) => {
          if (!option.label.trim()) {
            add(issues, `${path}.options.${optionIndex}.label`, 'กรุณาระบุชื่อตัวเลือก')
          }
          if (!option.optionKey.trim() || optionKeys.has(option.optionKey)) {
            add(
              issues,
              `${path}.options.${optionIndex}.optionKey`,
              'รหัสตัวเลือกต้องไม่ว่างและไม่ซ้ำในคำถาม',
            )
          }
          optionKeys.add(option.optionKey)
        })
      }

      if (question.type === 'rating_scale') {
        const scores = question.options
          .map((option) => option.score)
          .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
        if (scores.length !== question.options.length) {
          add(issues, `${path}.options`, 'ตัวเลือกคะแนนทุกข้อจำเป็นต้องมีค่าคะแนน')
        }
        const maxScore = scores.length > 0 ? Math.max(...scores) : null
        if (
          !Number.isFinite(question.positiveThreshold) ||
          maxScore === null ||
          question.positiveThreshold > maxScore
        ) {
          add(
            issues,
            `${path}.positiveThreshold`,
            'เกณฑ์ผลเชิงบวกต้องไม่เกินคะแนนสูงสุด',
          )
        }
      }

      if (question.type === 'number') {
        if (!Number.isFinite(question.min) || !Number.isFinite(question.max) || question.min > question.max) {
          add(issues, `${path}.min`, 'ค่าต่ำสุดต้องไม่เกินค่าสูงสุด')
        }
      }

      if (question.type === 'short_text' && (question.maxLength ?? 500) > 500) {
        add(issues, `${path}.maxLength`, 'ข้อความสั้นต้องไม่เกิน 500 ตัวอักษร')
      }
      if (question.type === 'long_text' && (question.maxLength ?? 4_000) > 4_000) {
        add(issues, `${path}.maxLength`, 'ข้อความยาวต้องไม่เกิน 4,000 ตัวอักษร')
      }
      if (question.type === 'yes_no' && question.options && question.options.length !== 2) {
        add(issues, `${path}.options`, 'คำถามใช่/ไม่ใช่ต้องมี 2 ตัวเลือก')
      }
    })
  })

  return issues
}
