import { calculateSurveyScore, type ScoreBucket, type ScoredAnswer } from './scoring'
import type { SurveyQuestion, SurveyVersionDefinition } from './types'

export type AggregateAnswerRow = {
  answerId?: string | null
  questionId: string
  optionId?: string | null
  numericValue?: number | null
  textValue?: string | null
  detailText?: string | null
  score?: number | null
  commentReadAt?: string | null
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
  behavior: {
    latestResponseAt: string | null
    optionalAnswerRatePct: number | null
    commentRatePct: number | null
    completenessPct: number | null
    commentCount: number
    unreadCommentCount: number
    responsesByWeekday: Array<{ label: string; count: number }>
    responsesByHour: Array<{ label: string; count: number }>
    responseScoreDistribution: Array<{ label: string; count: number }>
    demographicLabels: Record<string, { prompt: string; options: Record<string, string> }>
  }
  recentComments: Array<{
    answerId: string | null
    questionId: string
    prompt: string
    text: string
    submittedAt: string
    readAt: string | null
  }>
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function isAnswered(answer: AggregateAnswerRow | undefined) {
  if (!answer) return false
  return Boolean(
    answer.optionId
    || answer.numericValue !== null && answer.numericValue !== undefined
    || answer.score !== null && answer.score !== undefined
    || answer.textValue?.trim()
    || answer.detailText?.trim(),
  )
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
  const comments: NonNullable<SurveyDashboardData['recentComments']> = []
  const demographicLabels: SurveyDashboardData['behavior']['demographicLabels'] = {}

  rows.forEach((row) => {
    const responseScores: ScoredAnswer[] = []
    row.answers.forEach((answer) => {
      const question = questionById.get(answer.questionId)
      if (!question) return
      if (question.isComment && answer.textValue?.trim()) {
        comments.push({
          answerId: answer.answerId ?? null,
          questionId: question.id,
          prompt: question.prompt,
          text: answer.textValue.trim(),
          submittedAt: row.submittedAt,
          readAt: answer.commentReadAt ?? null,
        })
      }
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
          demographicLabels[question.questionKey] ??= { prompt: question.prompt, options: {} }
          demographicLabels[question.questionKey].options[option.value] = option.label
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

  const optionalQuestions = questions.filter((question) => !question.required)
  const totalExpectedAnswers = rows.length * questions.length
  const totalOptionalAnswers = rows.length * optionalQuestions.length
  let answeredCount = 0
  let answeredOptionalCount = 0
  const commentResponseIds = new Set<string>()
  const weekdayCounts = new Map<string, number>()
  const hourCounts = new Map<number, number>()
  const scoreDistribution = [
    { label: 'ต่ำกว่า 60%', count: 0 },
    { label: '60–79.99%', count: 0 },
    { label: 'ตั้งแต่ 80%', count: 0 },
  ]

  rows.forEach((row) => {
    const answersByQuestion = new Map(row.answers.map((answer) => [answer.questionId, answer]))
    questions.forEach((question) => {
      const answer = answersByQuestion.get(question.id)
      if (isAnswered(answer)) {
        answeredCount += 1
        if (!question.required) answeredOptionalCount += 1
        if (question.isComment && answer?.textValue?.trim()) commentResponseIds.add(row.responseId)
      }
    })
    const submittedAt = new Date(row.submittedAt)
    const weekday = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short' }).format(submittedAt)
    const hourPart = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).format(submittedAt)
    const hour = Number(hourPart) % 24
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1)
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
    const responseScore = calculateSurveyScore(scoreRowsByResponse.get(row.responseId) ?? []).normalizedPct
    if (responseScore !== null) {
      const bucket = responseScore < 60 ? 0 : responseScore < 80 ? 1 : 2
      scoreDistribution[bucket].count += 1
    }
  })

  const latestResponseAt = rows.reduce<string | null>(
    (latest, row) => !latest || new Date(row.submittedAt).getTime() > new Date(latest).getTime() ? row.submittedAt : latest,
    null,
  )
  const recentComments = comments
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5)

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
    behavior: {
      latestResponseAt,
      optionalAnswerRatePct: totalOptionalAnswers ? round2((answeredOptionalCount / totalOptionalAnswers) * 100) : null,
      commentRatePct: rows.length ? round2((commentResponseIds.size / rows.length) * 100) : null,
      completenessPct: totalExpectedAnswers ? round2((answeredCount / totalExpectedAnswers) * 100) : null,
      commentCount: comments.length,
      unreadCommentCount: comments.filter((comment) => !comment.readAt).length,
      responsesByWeekday: [...weekdayCounts].map(([label, count]) => ({ label, count })),
      responsesByHour: [...hourCounts].sort(([a], [b]) => a - b).map(([hour, count]) => ({ label: `${String(hour).padStart(2, '0')}:00`, count })),
      responseScoreDistribution: scoreDistribution,
      demographicLabels,
    },
    recentComments,
  }
}
