import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkloadDepts } from '@/lib/queries/workload'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const wantsTests = searchParams.get('tests') === '1'
  const deptId = searchParams.get('dept_id')

  if (wantsTests && deptId) {
    const { data, error } = await supabase
      .from('workload_tests')
      .select('id, ephis_code, test_name, price')
      .eq('dept_id', Number(deptId))
      .order('test_name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  const data = await getWorkloadDepts(supabase)
  return NextResponse.json(data)
}
