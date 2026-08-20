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

  it('sanitizes malicious markup embedded in chart content', () => {
    const song = parseChordPro('[C]<svg/onload=alert(1)>Amazing grace')
    const html = toDisplayHtml(song)
    expect(html).not.toContain('onload')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('alert(1)')
  })

  it('strips script tags injected via chart content', () => {
    const song = parseChordPro('[C]<script>alert(document.domain)</script>Amazing grace')
    const html = toDisplayHtml(song)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(document.domain)')
  })

  it('drops image directives so charts cannot trigger requests to attacker-chosen hosts', () => {
    const song = parseChordPro('{image: https://attacker.com/track.png}\n[C]Amazing grace')
    const html = toDisplayHtml(song)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('attacker.com')
  })

  it('drops style attributes so charts cannot inject arbitrary CSS', () => {
    const song = parseChordPro(
      '{textfont: Arial;background-image:url(https://attacker.com/x.png)}\n[C]Amazing grace'
    )
    const html = toDisplayHtml(song)
    expect(html).not.toContain('style=')
    expect(html).not.toContain('attacker.com')
  })

  it('renders chords exactly as typed, without normalizing suffixes', () => {
    const song = parseChordPro('[Dadd11/F#]Some lyric')
    const html = toDisplayHtml(song)
    expect(html).toContain('Dadd11/F#')
    expect(html).not.toContain('D(11)/F#')
  })

  it('still renders title and subtitle directives as headings', () => {
    const song = parseChordPro('{title: My Song}\n{subtitle: My Subtitle}\n[C]Amazing grace')
    const html = toDisplayHtml(song)
    expect(html).toContain('<h1 class="title">My Song</h1>')
    expect(html).toContain('<h2 class="subtitle">My Subtitle</h2>')
  })
})
