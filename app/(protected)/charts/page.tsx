import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'

export default async function ChartsLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  const { data: charts, error } = await supabase.rpc('search_charts', {
    search_term: q ?? '',
  })

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Charts</h1>
        <Link href="/charts/new" className={buttonVariants()}>
          New chart
        </Link>
      </div>

      <form className="max-w-sm">
        <Input type="search" name="q" placeholder="Search by title or artist" defaultValue={q ?? ''} />
      </form>

      {error && <p className="text-sm text-red-600">Something went wrong loading charts</p>}

      <ul className="divide-y">
        {(charts ?? []).map((chart: { id: string; title: string; artists: string[] | null; genre: string | null; key: string }) => (
          <li key={chart.id} className="py-3">
            <Link href={`/charts/${chart.id}`} className="font-medium hover:underline">
              {chart.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {chart.artists?.join(', ')} {chart.genre ? `· ${chart.genre}` : ''} · {chart.key}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
