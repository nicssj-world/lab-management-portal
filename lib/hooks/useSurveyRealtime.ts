'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type SurveyRealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export function useSurveyRealtime(
  campaignId: string | null,
  onRefetch: () => void,
  onStatusChange?: (status: SurveyRealtimeStatus) => void,
) {
  useEffect(() => {
    if (!campaignId) {
      onStatusChange?.('idle')
      return
    }
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    onStatusChange?.('connecting')
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
    ).subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatusChange?.('connected')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatusChange?.('error')
      else if (status === 'CLOSED') onStatusChange?.('disconnected')
    })
    return () => {
      if (timer) clearTimeout(timer)
      onStatusChange?.('disconnected')
      void supabase.removeChannel(channel)
    }
  }, [campaignId, onRefetch, onStatusChange])
}
