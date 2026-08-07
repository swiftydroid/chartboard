import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-8 space-y-2">
      <p>Logged in as {user!.email}</p>
      <p>Role: {profile?.role ?? 'unknown'}</p>
    </div>
  )
}
