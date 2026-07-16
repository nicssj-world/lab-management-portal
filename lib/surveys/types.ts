export const SURVEY_QUESTION_TYPES = [
  'single_choice',
  'short_text',
  'number',
  'rating_scale',
  'long_text',
  'yes_no',
] as const

export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number]
export type SurveyVersionStatus = 'draft' | 'published' | 'archived'
export type SurveyCampaignStatus = 'draft' | 'open' | 'closed'

export type SurveyOption = {
  id: string
  optionKey: string
  label: string
  value: string
  sortOrder: number
  score?: number | null
  allowsOtherText?: boolean
}

type SurveyQuestionBase = {
  id: string
  questionKey: string
  sectionId: string
  prompt: string
  required: boolean
  sortOrder: number
  helpText?: string | null
  isComment?: boolean
}

export type SingleChoiceQuestion = SurveyQuestionBase & {
  type: 'single_choice'
  options: ReadonlyArray<SurveyOption>
}

export type ShortTextQuestion = SurveyQuestionBase & {
  type: 'short_text'
  maxLength?: number
  placeholder?: string | null
}

export type NumberQuestion = SurveyQuestionBase & {
  type: 'number'
  min: number
  max: number
  placeholder?: string | null
}

export type RatingScaleQuestion = SurveyQuestionBase & {
  type: 'rating_scale'
  options: ReadonlyArray<SurveyOption>
  positiveThreshold: number
  allowDetailText?: boolean
  detailLabel?: string | null
}

export type LongTextQuestion = SurveyQuestionBase & {
  type: 'long_text'
  maxLength?: number
  placeholder?: string | null
}

export type YesNoQuestion = SurveyQuestionBase & {
  type: 'yes_no'
  options?: ReadonlyArray<SurveyOption>
}

export type SurveyQuestion =
  | SingleChoiceQuestion
  | ShortTextQuestion
  | NumberQuestion
  | RatingScaleQuestion
  | LongTextQuestion
  | YesNoQuestion

export type SurveySection = {
  id: string
  sectionKey: string
  title: string
  description?: string | null
  sortOrder: number
  questions: ReadonlyArray<SurveyQuestion>
}

export type SurveyVersionDefinition = {
  id: string
  surveyId: string
  versionNumber: number
  title: string
  description?: string | null
  status: SurveyVersionStatus
  publishedAt?: string | null
  sections: ReadonlyArray<SurveySection>
}

export type SurveyCampaign = {
  id: string
  surveyId: string
  surveyVersionId: string
  name: string
  publicToken: string
  status: SurveyCampaignStatus
  opensAt: string | null
  closesAt: string | null
  responseLimit: number | null
  onePerDevice: boolean
  responseCount?: number
  createdAt?: string
  updatedAt?: string
}

export type SurveyAnswerInput = {
  questionId: string
  optionId?: string | null
  numericValue?: number | null
  textValue?: string | null
  detailText?: string | null
}

export type SurveySubmission = {
  submissionKey: string
  answers: ReadonlyArray<SurveyAnswerInput>
}

export type NormalizedSurveyAnswer = {
  questionId: string
  sectionId: string
  optionId: string | null
  numericValue: number | null
  textValue: string | null
  detailText: string | null
  score: number | null
  maxScore: number | null
  positiveThreshold: number | null
  isComment: boolean
}

export type SubmissionValidationIssue = {
  questionId?: string
  message: string
}

export type SubmissionValidationResult =
  | { ok: true; answers: NormalizedSurveyAnswer[] }
  | { ok: false; issues: SubmissionValidationIssue[] }
