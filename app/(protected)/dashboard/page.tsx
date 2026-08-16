import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '../actions'
import { Button, buttonVariants } from '@/components/ui/button'

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
    <div className="p-8 space-y-4">
      <p>Logged in as {user!.email}</p>
      <p>Role: {profile?.role ?? 'unknown'}</p>
      <Link href="/charts" className={buttonVariants({ variant: 'outline' })}>
        Charts
      </Link>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </div>
  )
}
