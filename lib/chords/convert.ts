import ChordSheetJS from 'chordsheetjs'

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
  return new ChordSheetJS.HtmlDivFormatter().format(song)
}
