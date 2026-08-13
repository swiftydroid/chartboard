'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseChordsOverWords, toChordPro } from '@/lib/chords/convert'
import { annotateSectionLabels } from '@/lib/chords/section-labels'
import type { ChartFormValues } from '@/lib/charts/types'

function toStoredContent(rawTextareaText: string): string {
  const song = parseChordsOverWords(rawTextareaText)
  const chordPro = toChordPro(song)
  return annotateSectionLabels(chordPro)
}

export async function createChart(values: ChartFormValues): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('charts')
    .insert({
      title: values.title,
      artists: values.artists.length > 0 ? values.artists : null,
      genre: values.genre,
      key: values.key,
      tempo: values.tempo,
      time_signature: values.timeSignature,
      content: toStoredContent(values.content),
      owner_id: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Failed to create chart')
  }

  redirect(`/charts/${data.id}`)
}

export async function updateChart(chartId: string, values: ChartFormValues): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('charts')
    .update({
      title: values.title,
      artists: values.artists.length > 0 ? values.artists : null,
      genre: values.genre,
      key: values.key,
      tempo: values.tempo,
      time_signature: values.timeSignature,
      content: toStoredContent(values.content),
    })
    .eq('id', chartId)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Failed to update chart')
  }

  redirect(`/charts/${chartId}`)
}

export async function softDeleteChart(chartId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('charts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', chartId)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Failed to delete chart')
  }

  revalidatePath('/charts')
  redirect('/charts')
}
