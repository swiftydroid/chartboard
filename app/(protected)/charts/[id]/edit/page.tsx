import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseChordPro, toChordsOverWords } from '@/lib/chords/convert'
import { stripSectionLabelComments } from '@/lib/chords/section-labels'
import { canEditChart } from '@/lib/charts/permissions'
import { ChartForm } from '@/components/charts/chart-form'
import { updateChart } from '../../actions'

export default async function EditChartPage({
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

  const { data: chart, error } = await supabase
    .from('charts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error && error.code !== 'PGRST116') {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">Something went wrong loading this chart</p>
      </div>
    )
  }

  if (!chart) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  if (!canEditChart(chart, user.id, isAdmin)) {
    redirect(`/charts/${id}`)
  }

  const song = parseChordPro(stripSectionLabelComments(chart.content))
  const editableContent = toChordsOverWords(song)

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-4">Edit chart</h1>
      <ChartForm
        initialValues={{
          title: chart.title,
          artists: chart.artists ?? [],
          genre: chart.genre,
          key: chart.key,
          tempo: chart.tempo,
          timeSignature: chart.time_signature,
          content: editableContent,
        }}
        onSubmit={updateChart.bind(null, id)}
        submitLabel="Save changes"
      />
    </div>
  )
}
