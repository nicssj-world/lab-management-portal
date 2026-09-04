import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'

type SupabaseError = { code?: string; message?: string } | null

function isMissingAutoCheckoutFunction(error: SupabaseError) {
  if (!error) return false
  if (error.code === '42883' || error.code === 'PGRST202') return true
  return /could not find.*auto_checkout_it_visitor_logs|function .*auto_checkout_it_visitor_logs.*does not exist/i.test(error.message ?? '')
}

/**
 * Close stale visitor rows immediately on reads as a safety net for a delayed
 * scheduler. The SQL function is also run by Supabase Cron for unattended
 * records. Missing-function errors are tolerated while an existing deployment
 * is waiting for scripts/it-visitor-self-checkout.sql to be applied.
 */
export async function runVisitorAutoCheckout(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('auto_checkout_it_visitor_logs')
  if (error) {
    if (isMissingAutoCheckoutFunction(error)) return 0
    throw new Error(error.message)
  }

  const count = Number(data ?? 0)
  return Number.isFinite(count) ? count : 0
}
