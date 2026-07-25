import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { HeadContactCategory, HeadContactStatus } from './constants'
import type { HeadContactServiceUnit, HeadContactSubmission } from './types'

export type HeadContactListOptions = {
  page?: number
  pageSize?: number
  search?: string
  status?: HeadContactStatus
  category?: HeadContactCategory
  unitId?: string
  from?: string
  to?: string
}

export type HeadContactSummary = { new: number; in_progress: number; closed: number; awaiting_reply: number }

export async function getHeadContactSummary(): Promise<HeadContactSummary> {
  const count = async (apply: (query: ReturnType<typeof baseCountQuery>) => ReturnType<typeof baseCountQuery>) => {
    const { count: value, error } = await apply(baseCountQuery())
    if (error) throw new Error(error.message)
    return value ?? 0
  }
  const [fresh, inProgress, closed, awaitingReply] = await Promise.all([
    count((query) => query.eq('status', 'new')),
    count((query) => query.eq('status', 'in_progress')),
    count((query) => query.eq('status', 'closed')),
    count((query) => query.eq('wants_reply', true).is('contacted_at', null)),
  ])
  return { new: fresh, in_progress: inProgress, closed, awaiting_reply: awaitingReply }
}

function baseCountQuery() {
  return supabaseAdmin.from('head_contact_submissions').select('*', { count: 'exact', head: true })
}

export async function listHeadContactSubmissions(options: HeadContactListOptions = {}) {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50))
  let query = supabaseAdmin
    .from('head_contact_submissions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  const safeSearch = options.search?.replace(/[,%().]/g, ' ').trim().slice(0, 100)
  if (safeSearch) {
    const pattern = `%${safeSearch}%`
    query = query.or(`sender_name.ilike.${pattern},contact_channel.ilike.${pattern},detail.ilike.${pattern},service_unit_snapshot.ilike.${pattern}`)
  }
  if (options.status) query = query.eq('status', options.status)
  if (options.category) query = query.eq('category', options.category)
  if (options.unitId === 'other') query = query.is('service_unit_id', null)
  else if (options.unitId) query = query.eq('service_unit_id', options.unitId)
  if (options.from) query = query.gte('created_at', `${options.from}T00:00:00.000Z`)
  if (options.to) query = query.lte('created_at', `${options.to}T23:59:59.999Z`)

  const start = (page - 1) * pageSize
  const { data, count, error } = await query.range(start, start + pageSize - 1)
  if (error) throw new Error(error.message)
  return { rows: (data ?? []) as HeadContactSubmission[], total: count ?? 0, page, pageSize }
}

export async function listHeadContactUnits(): Promise<HeadContactServiceUnit[]> {
  const { data, error } = await supabaseAdmin
    .from('head_contact_service_units')
    .select('id, name, display_order, is_active')
    .order('display_order')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as HeadContactServiceUnit[]
}
