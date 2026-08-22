export type ManualValueConflict = 'campaign_reserved' | 'survey_published'

export function getManualValueConflict(input: {
  campaignReserved: boolean
  surveyPublicationExists: boolean
}): ManualValueConflict | null {
  if (input.surveyPublicationExists) return 'survey_published'
  if (input.campaignReserved) return 'campaign_reserved'
  return null
}

export function canDeactivateSatisfactionMetric(
  linkedCampaignStatuses: ReadonlyArray<string>,
): boolean {
  return linkedCampaignStatuses.every((status) => status === 'closed')
}
