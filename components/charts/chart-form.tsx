'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GENRES, KEYS, TIME_SIGNATURES, type Genre, type Key, type TimeSignature } from '@/lib/chords/constants'
import type { ChartFormValues } from '@/lib/charts/types'

interface ChartFormProps {
  initialValues?: Partial<ChartFormValues>
  onSubmit: (values: ChartFormValues) => Promise<void>
  submitLabel: string
}

export function ChartForm({ initialValues, onSubmit, submitLabel }: ChartFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [artistsText, setArtistsText] = useState(initialValues?.artists?.join(', ') ?? '')
  const [genre, setGenre] = useState<Genre | ''>(initialValues?.genre ?? '')
  const [key, setKey] = useState<Key | ''>(initialValues?.key ?? '')
  const [tempo, setTempo] = useState(initialValues?.tempo != null ? String(initialValues.tempo) : '')
  const [timeSignature, setTimeSignature] = useState<TimeSignature | ''>(
    initialValues?.timeSignature ?? ''
  )
  const [content, setContent] = useState(initialValues?.content ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!key) {
      setError('Key is required')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        artists: artistsText
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        genre: genre || null,
        key,
        tempo: tempo.trim() ? Number(tempo) : null,
        timeSignature: timeSignature || null,
        content,
      })
    } catch {
      setError('Something went wrong saving the chart')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="artists">Artists</Label>
        <Input
          id="artists"
          value={artistsText}
          onChange={(e) => setArtistsText(e.target.value)}
          placeholder="Comma-separated, e.g. Artist A, Artist B"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="genre">Genre</Label>
          <Select value={genre} onValueChange={(v) => setGenre(v as Genre)}>
            <SelectTrigger id="genre">
              <SelectValue placeholder="Select a genre" />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="key">Key</Label>
          <Select value={key} onValueChange={(v) => setKey(v as Key)}>
            <SelectTrigger id="key">
              <SelectValue placeholder="Select a key" />
            </SelectTrigger>
            <SelectContent>
              {KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tempo">Tempo (BPM)</Label>
          <Input id="tempo" type="number" value={tempo} onChange={(e) => setTempo(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeSignature">Time signature</Label>
          <Select value={timeSignature} onValueChange={(v) => setTimeSignature(v as TimeSignature)}>
            <SelectTrigger id="timeSignature">
              <SelectValue placeholder="Select a time signature" />
            </SelectTrigger>
            <SelectContent>
              {TIME_SIGNATURES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Chords and lyrics</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="font-mono"
          placeholder={
            'Type or paste chords above the lyric line, e.g.\nC       G       Am      F\nAmazing grace how sweet the sound'
          }
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : submitLabel}
      </Button>
    </form>
  )
}
