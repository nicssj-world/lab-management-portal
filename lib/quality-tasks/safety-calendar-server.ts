import 'server-only'

import type { PermLevel } from '@/lib/permissions'
import type { QualityTaskTemplate } from './types'
import { getQualityTaskOccurrences, getQualityTaskTemplates, listTaskPeople } from './server'
import { mergeSafetyCalendarOccurrences, SAFETY_MEETING_QUALITY_SOURCE_KEY } from './safety'

type SafetyCalendarInput = {
  from: string
  to: string
  actorId: string
  level: PermLevel
  scope?: 'mine' | 'all'
}

type PrefetchedSafetyCalendarData = {
  people?: Awaited<ReturnType<typeof listTaskPeople>>
  safetyTemplates?: QualityTaskTemplate[]
}

export async function getSafetyCalendarOccurrences(
  input: SafetyCalendarInput,
  prefetched: PrefetchedSafetyCalendarData = {},
) {
  const [people, safetyTemplates, qualityTemplates] = await Promise.all([
    prefetched.people ?? listTaskPeople(),
    prefetched.safetyTemplates ?? getQualityTaskTemplates(true, 'safety'),
    getQualityTaskTemplates(true, 'quality'),
  ])
  const qualityMeetingTemplates = qualityTemplates.filter(template => template.sourceKey === SAFETY_MEETING_QUALITY_SOURCE_KEY)
  const [safetyOccurrences, qualityMeetingOccurrences] = await Promise.all([
    getQualityTaskOccurrences(
      { ...input, workstream: 'safety' },
      { people, templates: safetyTemplates },
    ),
    getQualityTaskOccurrences(
      { ...input, scope: 'all', workstream: 'quality' },
      { people, templates: qualityMeetingTemplates },
    ),
  ])
  const linkedMeetingsInRange = qualityMeetingOccurrences.filter(
    item => item.effectiveDueDate >= input.from && item.effectiveDueDate <= input.to,
  )
  return mergeSafetyCalendarOccurrences(safetyOccurrences, linkedMeetingsInRange)
}
