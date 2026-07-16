export type ScoredAnswer = {
  questionId: string
  sectionId: string
  score: number | null
  maxScore: number
  positiveThreshold: number
}

export type ScoreDistribution = Record<1 | 2 | 3 | 4 | 5, number>

export type ScoreBucket = {
  normalizedPct: number | null
  positivePct: number | null
  averageScore: number | null
  validAnswerCount: number
  distribution: ScoreDistribution
}

export type SurveyScoreSummary = ScoreBucket & {
  sections: Record<string, ScoreBucket>
}

const createDistribution = (): ScoreDistribution => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
})

const roundToTwoDecimals = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100

function summarize(answers: ScoredAnswer[]): ScoreBucket {
  const validAnswers = answers.filter(
    (answer) =>
      answer.score !== null &&
      Number.isFinite(answer.score) &&
      Number.isFinite(answer.maxScore) &&
      answer.maxScore > 0,
  ) as Array<ScoredAnswer & { score: number }>

  if (validAnswers.length === 0) {
    return {
      normalizedPct: null,
      positivePct: null,
      averageScore: null,
      validAnswerCount: 0,
      distribution: createDistribution(),
    }
  }

  const scoreTotal = validAnswers.reduce((total, answer) => total + answer.score, 0)
  const maxScoreTotal = validAnswers.reduce(
    (total, answer) => total + answer.maxScore,
    0,
  )
  const positiveCount = validAnswers.filter(
    (answer) => answer.score >= answer.positiveThreshold,
  ).length
  const distribution = createDistribution()

  validAnswers.forEach((answer) => {
    const bucket = Math.min(5, Math.max(1, Math.round(answer.score))) as 1 | 2 | 3 | 4 | 5
    distribution[bucket] += 1
  })

  return {
    normalizedPct: roundToTwoDecimals((scoreTotal / maxScoreTotal) * 100),
    positivePct: roundToTwoDecimals((positiveCount / validAnswers.length) * 100),
    averageScore: roundToTwoDecimals(scoreTotal / validAnswers.length),
    validAnswerCount: validAnswers.length,
    distribution,
  }
}

export function calculateSurveyScore(answers: ScoredAnswer[]): SurveyScoreSummary {
  const bySection = answers.reduce<Record<string, ScoredAnswer[]>>((sections, answer) => {
    sections[answer.sectionId] ??= []
    sections[answer.sectionId].push(answer)
    return sections
  }, {})

  return {
    ...summarize(answers),
    sections: Object.fromEntries(
      Object.entries(bySection).map(([sectionId, sectionAnswers]) => [
        sectionId,
        summarize(sectionAnswers),
      ]),
    ),
  }
}
