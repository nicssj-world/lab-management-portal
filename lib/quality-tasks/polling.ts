export const QUALITY_TASK_POLL_INTERVAL_MS = 10_000

export function shouldPollQualityTaskDashboard(
  hasSelectedOccurrence: boolean,
  visibilityState: string,
) {
  return hasSelectedOccurrence && visibilityState === 'visible'
}
