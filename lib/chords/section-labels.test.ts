import { describe, expect, it } from 'vitest'
import {
  annotateSectionLabels,
  detectSectionLabel,
  stripSectionLabelComments,
} from './section-labels'

describe('detectSectionLabel', () => {
  it('detects a plain label', () => {
    expect(detectSectionLabel('Chorus')).toBe('Chorus')
  })

  it('detects a numbered label', () => {
    expect(detectSectionLabel('Verse 1')).toBe('Verse 1')
  })

  it('detects a label with a trailing colon', () => {
    expect(detectSectionLabel('Chorus:')).toBe('Chorus')
  })

  it('detects a bracketed label', () => {
    expect(detectSectionLabel('[Bridge]')).toBe('Bridge')
  })

  it('detects a hyphenated keyword', () => {
    expect(detectSectionLabel('Pre-Chorus')).toBe('Pre-Chorus')
  })

  it('is case-insensitive but returns the canonical casing', () => {
    expect(detectSectionLabel('chorus')).toBe('Chorus')
  })

  it('does not match a lyric line that mentions a keyword mid-sentence', () => {
    expect(detectSectionLabel('I love the chorus of this song')).toBeNull()
  })

  it('does not match an ordinary lyric line', () => {
    expect(detectSectionLabel('Amazing grace, how sweet the sound')).toBeNull()
  })

  it('does not match an empty line', () => {
    expect(detectSectionLabel('')).toBeNull()
  })
})

describe('annotateSectionLabels', () => {
  it('converts bare section-label lines to comment directives, leaves other lines untouched', () => {
    const input = 'Verse 1\nC       G\nAmazing grace how sweet the sound\nChorus:\nHow great is our God'
    const result = annotateSectionLabels(input)
    expect(result).toBe(
      '{comment: Verse 1}\nC       G\nAmazing grace how sweet the sound\n{comment: Chorus}\nHow great is our God'
    )
  })
})

describe('stripSectionLabelComments', () => {
  it('reverses annotateSectionLabels', () => {
    const annotated = '{comment: Verse 1}\nAmazing grace how sweet the sound\n{comment: Chorus}\nHow great is our God'
    const result = stripSectionLabelComments(annotated)
    expect(result).toBe('Verse 1\nAmazing grace how sweet the sound\nChorus\nHow great is our God')
  })

  it('leaves lines with no comment directive untouched', () => {
    expect(stripSectionLabelComments('Amazing grace')).toBe('Amazing grace')
  })
})
