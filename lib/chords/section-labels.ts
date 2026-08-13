const SECTION_KEYWORDS = [
  'Intro',
  'Pre-Chorus',
  'Chorus',
  'Verse',
  'Bridge',
  'Outro',
  'Tag',
  'Interlude',
] as const

const SECTION_LABEL_PATTERN = new RegExp(
  `^\\[?\\s*(${SECTION_KEYWORDS.join('|')})\\s*(\\d+)?\\s*:?\\s*\\]?$`,
  'i'
)

const COMMENT_DIRECTIVE_PATTERN = /^\{comment:\s*(.+)\}$/

export function detectSectionLabel(line: string): string | null {
  const trimmed = line.trim()
  if (trimmed === '') return null

  const match = trimmed.match(SECTION_LABEL_PATTERN)
  if (!match) return null

  const canonicalKeyword = SECTION_KEYWORDS.find(
    (keyword) => keyword.toLowerCase() === match[1].toLowerCase()
  )
  if (!canonicalKeyword) return null

  const number = match[2]
  return number ? `${canonicalKeyword} ${number}` : canonicalKeyword
}

export function annotateSectionLabels(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const label = detectSectionLabel(line)
      return label ? `{comment: ${label}}` : line
    })
    .join('\n')
}

export function stripSectionLabelComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const match = line.trim().match(COMMENT_DIRECTIVE_PATTERN)
      return match ? match[1] : line
    })
    .join('\n')
}
