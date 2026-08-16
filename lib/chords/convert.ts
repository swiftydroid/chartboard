import ChordSheetJS from 'chordsheetjs'
import DOMPurify from 'isomorphic-dompurify'

export type Song = ReturnType<InstanceType<typeof ChordSheetJS.ChordProParser>['parse']>

export function parseChordsOverWords(text: string): Song {
  return new ChordSheetJS.ChordsOverWordsParser().parse(text)
}

export function toChordPro(song: Song): string {
  return new ChordSheetJS.ChordProFormatter().format(song)
}

export function parseChordPro(text: string): Song {
  return new ChordSheetJS.ChordProParser().parse(text)
}

export function toChordsOverWords(song: Song): string {
  return new ChordSheetJS.ChordsOverWordsFormatter().format(song)
}

export function toDisplayHtml(song: Song): string {
  const rawHtml = new ChordSheetJS.HtmlDivFormatter().format(song)
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['div', 'h1', 'h2', 'h3', 'img'],
    ALLOWED_ATTR: ['class', 'style', 'src', 'width', 'height'],
  })
}

export function toDisplayCss(scope: string): string {
  return new ChordSheetJS.HtmlDivFormatter().cssString(scope)
}
