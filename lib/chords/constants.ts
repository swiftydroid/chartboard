export const GENRES = [
  'Blues',
  'Country',
  'Folk',
  'Gospel',
  'Hip-Hop',
  'Jazz',
  'Latin',
  'Mandopop',
  'Metal',
  'Pop',
  'R&B/Soul',
  'Reggae',
  'Rock',
  'Other',
] as const

export const KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
] as const

export const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '12/8'] as const

export type Genre = (typeof GENRES)[number]
export type Key = (typeof KEYS)[number]
export type TimeSignature = (typeof TIME_SIGNATURES)[number]
