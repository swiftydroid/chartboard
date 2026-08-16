import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseChordPro, toDisplayCss, toDisplayHtml } from '@/lib/chords/convert'
import { canEditChart } from '@/lib/charts/permissions'
import { buttonVariants } from '@/components/ui/button'
import { DeleteChartButton } from '@/components/charts/delete-chart-button'

export default async function ChartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: chart } = await supabase
    .from('charts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!chart) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const canEdit = canEditChart(chart, user.id, isAdmin)

  const song = parseChordPro(chart.content)
  const html = toDisplayHtml(song)
  const css = toDisplayCss('.chord-sheet')

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{chart.title}</h1>
          {chart.artists && chart.artists.length > 0 && (
            <p className="text-sm text-muted-foreground">{chart.artists.join(', ')}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {chart.key}
            {chart.genre ? ` · ${chart.genre}` : ''}
            {chart.time_signature ? ` · ${chart.time_signature}` : ''}
            {chart.tempo ? ` · ${chart.tempo} BPM` : ''}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link href={`/charts/${chart.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
              Edit
            </Link>
            <DeleteChartButton chartId={chart.id} />
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="chord-sheet" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
