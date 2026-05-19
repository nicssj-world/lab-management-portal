'use client'

import { useState, useEffect } from 'react'
import type { WorkloadDepartment } from '@/lib/supabase/types'

export function useDepartments() {
  const [departments, setDepartments] = useState<WorkloadDepartment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/lab-workload/api/departments')
      .then((r) => r.json())
      .then((data) => { setDepartments(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { departments, loading }
}
