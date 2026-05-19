'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeEntries(onUpdate: () => void) {
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('workload_entries_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workload_entries' },
        () => { onUpdate() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [onUpdate])
}
