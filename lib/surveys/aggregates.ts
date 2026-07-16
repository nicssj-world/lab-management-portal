import { calculateSurveyScore, type ScoreBucket, type ScoredAnswer } from './scoring'
import type { SurveyQuestion, SurveyVersionDefinition } from './types'

export type AggregateAnswerRow = {
  questionId: string
  optionId?: string | null
  numericValue?: number | null
  textValue?: string | null
  score?: number | null
}

export type AggregateResponseRow = {
  responseId: string
  submittedAt: string
  answers: AggregateAnswerRow[]
}

export type SurveyDashboardData = {
  responseCount: number
  overall: ScoreBucket
  sections: Array<ScoreBucket & { sectionId: string; title: string }>
  questions: Array<ScoreBucket & { questionId: string; prompt: string; answerCount: number }>
  trend: Array<{ period: string; normalizedPct: number | null; positivePct: number | null; responseCount: number }>
  demographics: Record<string, Record<string, number>>
}

function scoreMetadata(question: SurveyQuestion) {
  if (question.type !== 'rating_scale') return null
  const scores = question.options
    .map((option) => option.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
  if (scores.length === 0) return null
  return { maxScore: Math.max(...scores), positiveThreshold: question.positiveThreshold }
}

const periodKey = (value: string, grouping: 'day' | 'month') => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  const day = `${part('year')}-${part('month')}-${part('day')}`
  return grouping === 'month' ? day.slice(0, 7) : day
}

export function aggregateSurveyResults(
  definition: SurveyVersionDefinition,
  rows: AggregateResponseRow[],
  grouping: 'day' | 'month' = 'day',
): SurveyDashboardData {
  const questions = definition.sections.flatMap((section) => section.questions)
  const questionById = new Map(questions.map((question) => [question.id, question]))
  const scored: ScoredAnswer[] = []
  const scoreRowsByResponse = new Map<string, ScoredAnswer[]>()
  const demographics: Record<string, Record<string, number>> = {}

  rows.forEach((row) => {
    const responseScores: ScoredAnswer[] = []
    row.answers.forEach((answer) => {
      const question = questionById.get(answer.questionId)
      if (!question) return
      const metadata = scoreMetadata(question)
      if (metadata && typeof answer.score === 'number' && Number.isFinite(answer.score)) {
        const score: ScoredAnswer = {
          questionId: question.id,
          sectionId: question.sectionId,
          score: answer.score,
          maxScore: metadata.maxScore,
          positiveThreshold: metadata.positiveThreshold,
        }
        scored.push(score)
        responseScores.push(score)
        return
      }
      if (question.type === 'single_choice' || question.type === 'yes_no') {
        const option = question.options?.find((candidate) => candidate.id === answer.optionId)
        if (option) {
          demographics[question.questionKey] ??= {}
          demographics[question.questionKey][option.value] =
            (demographics[question.questionKey][option.value] ?? 0) + 1
        }
      }
    })
    scoreRowsByResponse.set(row.responseId, responseScores)
  })

  const overall = calculateSurveyScore(scored)
  const sectionSummaries = definition.sections
    .map((section) => ({
      section,
      summary: overall.sections[section.id] ?? calculateSurveyScore([]),
    }))
    .filter(({ summary }) => summary.validAnswerCount > 0)
    .map(({ section, summary }) => ({
      sectionId: section.id,
      title: section.title,
      normalizedPct: summary.normalizedPct,
      positivePct: summary.positivePct,
      averageScore: summary.averageScore,
      validAnswerCount: summary.validAnswerCount,
      distribution: summary.distribution,
    }))

  const questionSummaries = questions
    .filter((question) => question.type === 'rating_scale')
    .map((question) => {
      const summary = calculateSurveyScore(scored.filter((answer) => answer.questionId === question.id))
      return {
        questionId: question.id,
        prompt: question.prompt,
        answerCount: summary.validAnswerCount,
        normalizedPct: summary.normalizedPct,
        positivePct: summary.positivePct,
        averageScore: summary.averageScore,
        validAnswerCount: summary.validAnswerCount,
        distribution: summary.distribution,
      }
    })
    .sort((a, b) => (b.normalizedPct ?? -1) - (a.normalizedPct ?? -1))

  const periods = new Map<string, { responseIds: Set<string>; scores: ScoredAnswer[] }>()
  rows.forEach((row) => {
    const key = periodKey(row.submittedAt, grouping)
    const bucket = periods.get(key) ?? { responseIds: new Set<string>(), scores: [] }
    bucket.responseIds.add(row.responseId)
    bucket.scores.push(...(scoreRowsByResponse.get(row.responseId) ?? []))
    periods.set(key, bucket)
  })
  const trend = [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, bucket]) => {
    const summary = calculateSurveyScore(bucket.scores)
    return { period, normalizedPct: summary.normalizedPct, positivePct: summary.positivePct, responseCount: bucket.responseIds.size }
  })

  return {
    responseCount: new Set(rows.map((row) => row.responseId)).size,
    overall: {
      normalizedPct: overall.normalizedPct,
      positivePct: overall.positivePct,
      averageScore: overall.averageScore,
      validAnswerCount: overall.validAnswerCount,
      distribution: overall.distribution,
    },
    sections: sectionSummaries,
    questions: questionSummaries,
    trend,
    demographics,
  }
}
