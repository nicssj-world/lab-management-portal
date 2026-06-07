// SERVER ONLY — never import in 'use client' components
import { createClient } from '@supabase/supabase-js'
import { requiredEnv } from '@/lib/env'

export const supabaseAdmin = createClient(
  requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
)
