import { createClient } from '@supabase/supabase-js'
import { getSupabaseServiceEnv, optionalEnv } from './lib/env.mjs'

const { url: supabaseUrl, serviceRoleKey } = getSupabaseServiceEnv()
const adminEmail = process.argv[2] ?? optionalEnv('ADMIN_EMAIL')
const adminPassword = process.argv[3] ?? optionalEnv('ADMIN_PASSWORD')
const adminName = optionalEnv('ADMIN_NAME') ?? 'Admin User'
const adminRole = optionalEnv('ADMIN_ROLE') ?? 'Admin'
const adminDept = optionalEnv('ADMIN_DEPT') ?? 'Medical Technology'

if (!adminEmail || !adminPassword) {
  console.error('Usage: node scripts/create-admin.mjs <admin_email> <admin_password>')
  console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function createAdmin() {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { name: adminName }
    })

    if (authError) {
      console.error('❌ Auth error:', authError)
      return
    }

    console.log('✅ Auth user created:', authData.user.id)

    // Create profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        name: adminName,
        role: adminRole,
        dept: adminDept,
        status: 'active'
      })

    if (profileError) {
      console.error('❌ Profile error:', profileError)
      return
    }

    console.log('✅ Admin profile created')
    console.log('\n📋 Admin credentials:')
    console.log(`   Email: ${adminEmail}`)
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

createAdmin()
