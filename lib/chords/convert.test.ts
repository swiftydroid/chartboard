import { describe, expect, it } from 'vitest'
import {
  parseChordPro,
  parseChordsOverWords,
  toChordPro,
  toChordsOverWords,
  toDisplayHtml,
} from './convert'

describe('parseChordsOverWords + toChordPro', () => {
  it('converts a simple chords-over-words sheet to ChordPro inline chords', () => {
    const input = 'C       G\nAmazing grace how sweet the sound'
    const song = parseChordsOverWords(input)
    const chordPro = toChordPro(song)
    expect(chordPro).toContain('[C]Amazing')
  })

  it('preserves slash chords and flats', () => {
    const input = 'C/D           Bb\nHello there   friend'
    const song = parseChordsOverWords(input)
    const chordPro = toChordPro(song)
    expect(chordPro).toContain('[C/D]')
    expect(chordPro).toContain('[Bb]')
  })
})

describe('parseChordPro + toChordsOverWords round trip', () => {
  it('round-trips inline chords back to a chords-over-words layout', () => {
    const chordProInput = '[C]Amazing [G]grace how sweet the [C]sound'
    const song = parseChordPro(chordProInput)
    const backToWords = toChordsOverWords(song)
    expect(backToWords).toContain('Amazing')
    expect(backToWords).toContain('grace how sweet the')
    expect(backToWords).toMatch(/C/)
    expect(backToWords).toMatch(/G/)
  })
})

describe('toDisplayHtml', () => {
  it('renders chord and lyric content as HTML', () => {
    const song = parseChordPro('[C]Amazing [G]grace')
    const html = toDisplayHtml(song)
    expect(html).toContain('Amazing')
    expect(html).toContain('grace')
  })
})
