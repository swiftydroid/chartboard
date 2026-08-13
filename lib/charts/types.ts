import type { Genre, Key, TimeSignature } from '@/lib/chords/constants'

export interface ChartFormValues {
  title: string
  artists: string[]
  genre: Genre | null
  key: Key
  tempo: number | null
  timeSignature: TimeSignature | null
  content: string
}
