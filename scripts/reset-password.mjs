import { createClient } from '@supabase/supabase-js'
import { getSupabaseServiceEnv } from './lib/env.mjs'

const { url: supabaseUrl, serviceRoleKey } = getSupabaseServiceEnv()

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

const ephisId = process.argv[2]
const newPassword = process.argv[3]

if (!ephisId || !newPassword) {
  console.error('Usage: node scripts/reset-password.mjs <ephis_id> <new_password>')
  console.error('Example: node scripts/reset-password.mjs 9495 NewPassword123!')
  process.exit(1)
}

const email = `${ephisId}@cbh.go.th`

async function resetPassword() {
  // Find user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) { console.error('❌ Cannot list users:', listError.message); process.exit(1) }

  const user = users.find(u => u.email === email)
  if (!user) { console.error(`❌ ไม่พบผู้ใช้ E-Phis ${ephisId} (${email})`); process.exit(1) }

  console.log(`✓ พบผู้ใช้: ${user.email} (ID: ${user.id})`)

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword })
  if (error) { console.error('❌ Reset ไม่สำเร็จ:', error.message); process.exit(1) }

  console.log(`✅ Reset password สำเร็จ`)
  console.log(`   E-Phis  : ${ephisId}`)
}

resetPassword()
