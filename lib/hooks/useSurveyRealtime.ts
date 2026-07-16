'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useSurveyRealtime(campaignId: string | null, onRefetch: () => void) {
  useEffect(() => {
    if (!campaignId) return
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase.channel(`survey-events-${campaignId}`).on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'survey_response_events',
        filter: `campaign_id=eq.${campaignId}`,
      },
      () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(onRefetch, 350)
      },
    ).subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [campaignId, onRefetch])
}
