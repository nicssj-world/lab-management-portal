'use client'

import { useState, useEffect } from 'react'
import type { WorkloadSummaryRow } from '@/lib/queries/workload'

export function useWorkload(year: number, month: number) {
  const [summary, setSummary] = useState<WorkloadSummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/lab-workload/api/entries?year=${year}&month=${month}&view=summary`)
      .then((r) => r.json())
      .then((data) => { setSummary(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month])

  return { summary, loading, refetch: () => {} }
}
