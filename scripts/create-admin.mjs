import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fslagsuorkcckvvtrmyi.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGFnc3VvcmtjY2t2dnRybXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4MDc1OSwiZXhwIjoyMDk0NzU2NzU5fQ.6OwSnEAaMWpwQ52QaubLxIHDcqRVE-pj0qJWNGaFYdY'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function createAdmin() {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@cbh.go.th',
      password: 'AdminPassword123!',
      email_confirm: true,
      user_metadata: { name: 'Admin User' }
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
        name: 'Admin User',
        role: 'admin',
        dept: 'Medical Technology',
        status: 'active'
      })

    if (profileError) {
      console.error('❌ Profile error:', profileError)
      return
    }

    console.log('✅ Admin profile created')
    console.log('\n📋 Admin credentials:')
    console.log('   Email: admin@cbh.go.th')
    console.log('   Password: AdminPassword123!')
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

createAdmin()
