# Chord Chart Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build core chord chart CRUD (create, view, edit, soft-delete, search) with a ChordPro-based chords-over-lyrics editor, on top of the chunk 1 auth foundation.

**Architecture:** A single `charts` table (Postgres, RLS-gated) stores each chart's metadata and its body as ChordPro text. All parsing/formatting between ChordPro and the chords-over-lyrics textarea format goes through one wrapper module (`lib/chords/convert.ts`) built on the `chordsheetjs` library, so no page ever imports ChordSheetJS directly. Section labels (Verse, Chorus, etc.) are handled as a separate pure text pre/post-processing step, not by relying on undocumented ChordSheetJS parser behavior. Ownership/admin access is enforced twice: RLS at the database (the real boundary) and a pure `canEditChart` predicate at the app layer (fast UX-level gating), matching chunk 1's two-layer pattern.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Supabase (Postgres + Auth, RLS), `chordsheetjs`, Tailwind CSS + shadcn/ui, Vitest.

## Global Constraints

- Next.js 16 App Router only, TypeScript, Node 24 (inherited from chunk 1)
- Supabase: hosted Free-tier project, no local CLI/Docker stack (inherited from chunk 1)
- Styling: Tailwind CSS + shadcn/ui only
- New dependency this chunk: `chordsheetjs` — parses/formats ChordPro and chords-over-words text
- Storage format: every chart's `content` column is ChordPro text. UI code never calls ChordSheetJS directly — always through `lib/chords/convert.ts`
- Soft delete only: no code path in this chunk issues a real Postgres `DELETE` on `charts`. Deleting a chart is `UPDATE charts SET deleted_at = now()`
- `key` is required (not null) on every chart. `artists`, `genre`, `tempo`, `time_signature` are all optional
- Genre/key/time-signature are fixed lists enforced by DB check constraints in `supabase/migrations/0002_charts.sql`. The UI dropdown values in `lib/chords/constants.ts` must match those constraints exactly — if you ever change one, change both
- **No automated tests except pure logic with no external dependency** — matching chunk 1's convention. Unit tested in this chunk: section-label text processing (Task 3), the ChordSheetJS conversion wrapper's round-trip behavior (Task 4), and the `canEditChart` permission predicate (Task 9). Everything else (Server Actions, pages) is thin glue around the Supabase SDK and is covered only by the manual verification checklist (Task 11) — a mocked test there would just re-assert the mock, not catch real RLS bugs.
- Test runner: Vitest (already installed, see `package.json`)
- Design reference: `docs/specs/chord-chart-management-design.md`

---

## File Structure

```
chartboard/
├── supabase/
│   └── migrations/
│       └── 0002_charts.sql              # charts table, RLS, updated_at trigger, search_charts() RPC
├── lib/
│   ├── chords/
│   │   ├── constants.ts                 # GENRES, KEYS, TIME_SIGNATURES — mirrors the migration's check constraints
│   │   ├── section-labels.ts            # annotateSectionLabels(), stripSectionLabelComments() — pure text functions
│   │   ├── section-labels.test.ts
│   │   ├── convert.ts                   # thin ChordSheetJS wrapper: parse/format functions + Song type
│   │   └── convert.test.ts
│   └── charts/
│       ├── types.ts                     # ChartFormValues shared by actions.ts and chart-form.tsx
│       ├── permissions.ts               # canEditChart()
│       └── permissions.test.ts
├── components/
│   ├── ui/                              # + textarea.tsx, select.tsx, alert-dialog.tsx (shadcn add)
│   └── charts/
│       ├── chart-form.tsx               # shared metadata + textarea form (Create & Edit)
│       └── delete-chart-button.tsx      # confirm dialog + soft-delete trigger
└── app/
    └── (protected)/
        └── charts/
            ├── actions.ts               # createChart, updateChart, softDeleteChart Server Actions
            ├── page.tsx                 # Library (search + list)
            ├── new/
            │   └── page.tsx             # Create
            └── [id]/
                ├── page.tsx             # View
                └── edit/
                    └── page.tsx         # Edit
```

---

### Task 1: Install ChordSheetJS and add shadcn components

**Files:**
- Modify: `package.json` (new dependency, new devDependencies from shadcn add)
- Create: `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/ui/alert-dialog.tsx`

**Interfaces:**
- Produces: `chordsheetjs` importable as `import ChordSheetJS from 'chordsheetjs'`; `Textarea`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, and `AlertDialog`/`AlertDialogTrigger`/`AlertDialogContent`/`AlertDialogHeader`/`AlertDialogTitle`/`AlertDialogDescription`/`AlertDialogFooter`/`AlertDialogCancel`/`AlertDialogAction` importable from `@/components/ui/*`.

- [ ] **Step 1: Install ChordSheetJS**

Run: `npm install chordsheetjs`

- [ ] **Step 2: Add the shadcn/ui components this chunk needs**

Run: `npx shadcn@latest add textarea select alert-dialog`

- [ ] **Step 3: Verify the install**

Run: `npm run build`
Expected: build succeeds with no type errors (nothing references the new packages/components yet, which is fine).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Install chordsheetjs and shadcn textarea/select/alert-dialog components"
```

---

### Task 2: Database schema — charts table, RLS, updated_at trigger, search function

**Files:**
- Create: `supabase/migrations/0002_charts.sql`

**Interfaces:**
- Produces: `public.charts` table with columns `id uuid`, `title text`, `artists text[]`, `genre text`, `key text`, `tempo integer`, `time_signature text`, `content text`, `owner_id uuid`, `deleted_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz`. Also `public.search_charts(search_term text) returns setof public.charts`, callable via `supabase.rpc('search_charts', { search_term })`. Every later task that queries `charts` relies on these exact column names.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0002_charts.sql`:
```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.charts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artists text[],
  genre text check (genre in (
    'Blues', 'Country', 'Folk', 'Gospel', 'Hip-Hop', 'Jazz', 'Latin',
    'Mandopop', 'Metal', 'Pop', 'R&B/Soul', 'Reggae', 'Rock', 'Other'
  )),
  key text not null check (key in (
    'C','C#','D','D#','E','F','F#','G','G#','A','A#','B',
    'Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm'
  )),
  tempo integer,
  time_signature text check (time_signature in ('4/4','3/4','2/4','6/8','12/8')),
  content text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_charts_updated_at
  before update on public.charts
  for each row execute procedure public.set_updated_at();

alter table public.charts enable row level security;

create policy "Any authenticated user can view charts"
  on public.charts for select
  to authenticated
  using (true);

create policy "Authenticated users can create their own charts"
  on public.charts for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their charts; admins can update ownerless charts"
  on public.charts for update
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      owner_id is null
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

create or replace function public.search_charts(search_term text)
returns setof public.charts
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.charts
  where deleted_at is null
    and (
      search_term = ''
      or title ilike '%' || search_term || '%'
      or exists (
        select 1 from unnest(artists) as artist
        where artist ilike '%' || search_term || '%'
      )
    )
  order by title asc;
$$;

grant execute on function public.search_charts(text) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Open the Supabase dashboard → SQL Editor → paste the full contents of `supabase/migrations/0002_charts.sql` → Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Verify the check constraints work**

In the SQL Editor, run (replace with a real user id from `select id from auth.users limit 1;` if needed):
```sql
insert into public.charts (title, key, content, owner_id)
values ('Test invalid key', 'X', 'test', (select id from auth.users limit 1));
```
Expected: fails with a check constraint violation on `key` (confirms the constraint is active). Then run a valid insert:
```sql
insert into public.charts (title, key, content, owner_id)
values ('Amazing Grace', 'G', '[G]Amazing [C]grace', (select id from auth.users limit 1));
```
Expected: "Success. 1 rows affected."

- [ ] **Step 4: Verify the search function**

In the SQL Editor, run:
```sql
select title, key from public.search_charts('grace');
```
Expected: returns the row inserted above. Then run `select title, key from public.search_charts('');` — expected: also returns it (empty search term matches everything).

- [ ] **Step 5: Clean up the test row**

```sql
delete from public.charts where title = 'Amazing Grace';
```
(This is a direct SQL Editor delete for test cleanup only — the app itself never issues a real `DELETE`.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_charts.sql
git commit -m "Add charts table, RLS policies, updated_at trigger, and search function"
```

---

### Task 3: Section-label text processing

**Files:**
- Create: `lib/chords/section-labels.ts`
- Test: `lib/chords/section-labels.test.ts`

**Interfaces:**
- Produces:
  - `detectSectionLabel(line: string): string | null` — returns the canonical label (e.g. `"Verse 1"`) if the line is *only* a section label, else `null`.
  - `annotateSectionLabels(text: string): string` — replaces bare section-label lines with `{comment: <label>}`.
  - `stripSectionLabelComments(text: string): string` — reverses `annotateSectionLabels`, turning `{comment: <label>}` lines back into plain label text.

- [ ] **Step 1: Write the failing tests**

Create `lib/chords/section-labels.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run lib/chords/section-labels.test.ts`
Expected: FAIL — `section-labels.ts` does not exist yet, import fails to resolve.

- [ ] **Step 3: Write the implementation**

Create `lib/chords/section-labels.ts`:
```ts
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
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run lib/chords/section-labels.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/chords/section-labels.ts lib/chords/section-labels.test.ts
git commit -m "Add pure section-label detection and comment-directive conversion"
```

---

### Task 4: ChordSheetJS conversion wrapper

**Files:**
- Create: `lib/chords/convert.ts`
- Test: `lib/chords/convert.test.ts`

**Interfaces:**
- Consumes: `chordsheetjs` (Task 1).
- Produces:
  - `type Song` — the ChordSheetJS parsed-song type, re-exported for use by pages.
  - `parseChordsOverWords(text: string): Song`
  - `toChordPro(song: Song): string`
  - `parseChordPro(text: string): Song`
  - `toChordsOverWords(song: Song): string`
  - `toDisplayHtml(song: Song): string`

These are thin 1:1 wraps only — no section-label handling here (that's Task 3's job; call sites compose the two).

- [ ] **Step 1: Write the failing tests**

Create `lib/chords/convert.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run lib/chords/convert.test.ts`
Expected: FAIL — `convert.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `lib/chords/convert.ts`:
```ts
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
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run lib/chords/convert.test.ts`
Expected: PASS. If an assertion fails because ChordSheetJS's actual output format differs slightly from what's asserted here (e.g. exact whitespace in `toChordsOverWords`), inspect the actual output with a quick `console.log`, and adjust the test's assertions to match the library's real behavior — the wrapper implementation itself (Step 3) should not need any logic beyond the direct pass-through shown above. Do not weaken a test to hide a real bug; only adjust assertions that were wrong about the library's exact output format.

- [ ] **Step 5: Commit**

```bash
git add lib/chords/convert.ts lib/chords/convert.test.ts
git commit -m "Add ChordSheetJS conversion wrapper with round-trip tests"
```

---

### Task 5: Chart constants, form types, and shared chart form component

**Files:**
- Create: `lib/chords/constants.ts`
- Create: `lib/charts/types.ts`
- Create: `components/charts/chart-form.tsx`

**Interfaces:**
- Consumes: `Textarea`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Input`, `Label`, `Button` from `@/components/ui/*` (Task 1 and chunk 1).
- Produces:
  - `GENRES: readonly string[]`, `KEYS: readonly string[]`, `TIME_SIGNATURES: readonly string[]`, and types `Genre`, `Key`, `TimeSignature` from `lib/chords/constants.ts`.
  - `interface ChartFormValues { title: string; artists: string[]; genre: Genre | null; key: Key; tempo: number | null; timeSignature: TimeSignature | null; content: string }` from `lib/charts/types.ts` — Task 6's Server Actions and Task 7/10's pages both depend on this exact shape.
  - `<ChartForm initialValues={...} onSubmit={...} submitLabel={...} />` from `components/charts/chart-form.tsx`, where `onSubmit: (values: ChartFormValues) => Promise<void>`.

- [ ] **Step 1: Write the constants, matching the migration's check constraints exactly**

Create `lib/chords/constants.ts`:
```ts
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
```

- [ ] **Step 2: Write the shared form values type**

Create `lib/charts/types.ts`:
```ts
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
```

- [ ] **Step 3: Write the chart form component**

Create `components/charts/chart-form.tsx`:
```tsx
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
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: build succeeds with no type errors (nothing imports `ChartForm` yet, but TypeScript must resolve all types cleanly).

- [ ] **Step 5: Commit**

```bash
git add lib/chords/constants.ts lib/charts/types.ts components/charts/chart-form.tsx
git commit -m "Add chart constants, form value types, and shared chart form component"
```

---

### Task 6: Server Actions — create, update, soft-delete

**Files:**
- Create: `app/(protected)/charts/actions.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts` (chunk 1); `ChartFormValues` from `lib/charts/types.ts` (Task 5); `parseChordsOverWords`, `toChordPro` from `lib/chords/convert.ts` (Task 4); `annotateSectionLabels` from `lib/chords/section-labels.ts` (Task 3).
- Produces:
  - `createChart(values: ChartFormValues): Promise<void>` — inserts a row, redirects to `/charts/[id]`.
  - `updateChart(chartId: string, values: ChartFormValues): Promise<void>` — updates a row, redirects to `/charts/[id]`.
  - `softDeleteChart(chartId: string): Promise<void>` — sets `deleted_at`, redirects to `/charts`.

- [ ] **Step 1: Write the actions**

Create `app/(protected)/charts/actions.ts`:
```ts
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

  const { error } = await supabase
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

  if (error) {
    throw new Error('Failed to update chart')
  }

  redirect(`/charts/${chartId}`)
}

export async function softDeleteChart(chartId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('charts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', chartId)

  if (error) {
    throw new Error('Failed to delete chart')
  }

  revalidatePath('/charts')
  redirect('/charts')
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/charts/actions.ts"
git commit -m "Add createChart, updateChart, and softDeleteChart server actions"
```

---

### Task 7: Create page

**Files:**
- Create: `app/(protected)/charts/new/page.tsx`

**Interfaces:**
- Consumes: `ChartForm` from `components/charts/chart-form.tsx` (Task 5); `createChart` from `app/(protected)/charts/actions.ts` (Task 6).
- Produces: the `/charts/new` route.

- [ ] **Step 1: Write the page**

Create `app/(protected)/charts/new/page.tsx`:
```tsx
import { ChartForm } from '@/components/charts/chart-form'
import { createChart } from '../actions'

export default function NewChartPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-4">New chart</h1>
      <ChartForm onSubmit={createChart} submitLabel="Create chart" />
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, log in, visit `http://localhost:3000/charts/new`. Fill in a title, key, and a few lines in the textarea (e.g. `C       G\nAmazing grace how sweet the sound`), submit.
Expected: redirected to `/charts/<new-id>` (a 404 is fine at this point — the View page doesn't exist until Task 9 — what matters is the URL changed and the Supabase Table Editor shows a new row in `charts` with `content` containing `[C]Amazing [G]grace how sweet the sound` or similar inline-chord ChordPro text).

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/charts/new/page.tsx"
git commit -m "Add chart creation page"
```

---

### Task 8: Library page (search + list)

**Files:**
- Create: `app/(protected)/charts/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts`; the `search_charts` RPC (Task 2).
- Produces: the `/charts` route.

- [ ] **Step 1: Write the page**

Create `app/(protected)/charts/page.tsx`:
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default async function ChartsLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  const { data: charts } = await supabase.rpc('search_charts', {
    search_term: q ?? '',
  })

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Charts</h1>
        <Button asChild>
          <Link href="/charts/new">New chart</Link>
        </Button>
      </div>

      <form className="max-w-sm">
        <Input type="search" name="q" placeholder="Search by title or artist" defaultValue={q ?? ''} />
      </form>

      <ul className="divide-y">
        {(charts ?? []).map((chart: { id: string; title: string; artists: string[] | null; genre: string | null; key: string }) => (
          <li key={chart.id} className="py-3">
            <Link href={`/charts/${chart.id}`} className="font-medium hover:underline">
              {chart.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {chart.artists?.join(', ')} {chart.genre ? `· ${chart.genre}` : ''} · {chart.key}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `http://localhost:3000/charts`.
Expected: the chart created in Task 7 appears in the list, showing title, key, and genre/artists if set. Type part of the title into the search box and submit (Enter) — expected: URL gains `?q=...`, list filters to matching charts only. Clear the search box and submit — expected: full list returns.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/charts/page.tsx"
git commit -m "Add chart library page with search"
```

---

### Task 9: Permission predicate, View page, and delete button

**Files:**
- Create: `lib/charts/permissions.ts`
- Test: `lib/charts/permissions.test.ts`
- Create: `components/charts/delete-chart-button.tsx`
- Create: `app/(protected)/charts/[id]/page.tsx`

**Interfaces:**
- Consumes: `parseChordPro`, `toDisplayHtml` from `lib/chords/convert.ts` (Task 4); `softDeleteChart` from `app/(protected)/charts/actions.ts` (Task 6); `AlertDialog*` from `@/components/ui/alert-dialog` (Task 1).
- Produces:
  - `canEditChart(chart: { owner_id: string | null }, currentUserId: string, isAdmin: boolean): boolean` from `lib/charts/permissions.ts` — Task 10's Edit page also depends on this exact signature.
  - `<DeleteChartButton chartId={string} />` from `components/charts/delete-chart-button.tsx`.
  - The `/charts/[id]` route.

- [ ] **Step 1: Write the failing permission tests**

Create `lib/charts/permissions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { canEditChart } from './permissions'

describe('canEditChart', () => {
  it('allows the owner', () => {
    expect(canEditChart({ owner_id: 'user-1' }, 'user-1', false)).toBe(true)
  })

  it('denies a non-owner on a chart that has an owner', () => {
    expect(canEditChart({ owner_id: 'user-1' }, 'user-2', false)).toBe(false)
  })

  it('denies a non-admin on an ownerless chart', () => {
    expect(canEditChart({ owner_id: null }, 'user-2', false)).toBe(false)
  })

  it('allows an admin on an ownerless chart', () => {
    expect(canEditChart({ owner_id: null }, 'user-2', true)).toBe(true)
  })

  it('denies an admin on a chart that still has a different owner', () => {
    expect(canEditChart({ owner_id: 'user-1' }, 'user-2', true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run lib/charts/permissions.test.ts`
Expected: FAIL — `permissions.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `lib/charts/permissions.ts`:
```ts
export interface ChartOwnership {
  owner_id: string | null
}

export function canEditChart(chart: ChartOwnership, currentUserId: string, isAdmin: boolean): boolean {
  if (chart.owner_id === currentUserId) return true
  if (chart.owner_id === null && isAdmin) return true
  return false
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run lib/charts/permissions.test.ts`
Expected: PASS — all 5 cases green.

- [ ] **Step 5: Write the delete confirm button**

Create `components/charts/delete-chart-button.tsx`:
```tsx
'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { softDeleteChart } from '@/app/(protected)/charts/actions'

export function DeleteChartButton({ chartId }: { chartId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chart?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes it from the library. It is not permanently erased.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => softDeleteChart(chartId)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 6: Write the View page**

Create `app/(protected)/charts/[id]/page.tsx`:
```tsx
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseChordPro, toDisplayHtml } from '@/lib/chords/convert'
import { canEditChart } from '@/lib/charts/permissions'
import { Button } from '@/components/ui/button'
import { DeleteChartButton } from '@/components/charts/delete-chart-button'

export default async function ChartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: chart } = await supabase
    .from('charts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!chart) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const canEdit = canEditChart(chart, user.id, isAdmin)

  const song = parseChordPro(chart.content)
  const html = toDisplayHtml(song)

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{chart.title}</h1>
          {chart.artists && chart.artists.length > 0 && (
            <p className="text-sm text-muted-foreground">{chart.artists.join(', ')}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {chart.key}
            {chart.genre ? ` · ${chart.genre}` : ''}
            {chart.time_signature ? ` · ${chart.time_signature}` : ''}
            {chart.tempo ? ` · ${chart.tempo} BPM` : ''}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/charts/${chart.id}/edit`}>Edit</Link>
            </Button>
            <DeleteChartButton chartId={chart.id} />
          </div>
        )}
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, visit `/charts/<id>` for the chart created in Task 7.
Expected: title/key/genre render, chords/lyrics render below (chords visually above lyrics), Edit and Delete buttons are visible (you own this chart). Click Delete → confirm dialog appears → confirm → redirected to `/charts`, chart no longer listed. In the Supabase Table Editor, confirm the row still exists with `deleted_at` set (not removed).

- [ ] **Step 8: Commit**

```bash
git add lib/charts/permissions.ts lib/charts/permissions.test.ts components/charts/delete-chart-button.tsx "app/(protected)/charts/[id]/page.tsx"
git commit -m "Add chart view page with owner/admin-gated edit and soft delete"
```

---

### Task 10: Edit page

**Files:**
- Create: `app/(protected)/charts/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `parseChordPro`, `toChordsOverWords` from `lib/chords/convert.ts` (Task 4); `stripSectionLabelComments` from `lib/chords/section-labels.ts` (Task 3); `canEditChart` from `lib/charts/permissions.ts` (Task 9); `ChartForm` from `components/charts/chart-form.tsx` (Task 5); `updateChart` from `app/(protected)/charts/actions.ts` (Task 6).
- Produces: the `/charts/[id]/edit` route.

- [ ] **Step 1: Write the page**

Create `app/(protected)/charts/[id]/edit/page.tsx`:
```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseChordPro, toChordsOverWords } from '@/lib/chords/convert'
import { stripSectionLabelComments } from '@/lib/chords/section-labels'
import { canEditChart } from '@/lib/charts/permissions'
import { ChartForm } from '@/components/charts/chart-form'
import { updateChart } from '../../actions'

export default async function EditChartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: chart } = await supabase
    .from('charts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!chart) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  if (!canEditChart(chart, user.id, isAdmin)) {
    redirect(`/charts/${id}`)
  }

  const song = parseChordPro(stripSectionLabelComments(chart.content))
  const editableContent = toChordsOverWords(song)

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-4">Edit chart</h1>
      <ChartForm
        initialValues={{
          title: chart.title,
          artists: chart.artists ?? [],
          genre: chart.genre,
          key: chart.key,
          tempo: chart.tempo,
          timeSignature: chart.time_signature,
          content: editableContent,
        }}
        onSubmit={updateChart.bind(null, id)}
        submitLabel="Save changes"
      />
    </div>
  )
}
```

- [ ] **Step 2: Manual verification — owner edit round-trip**

Run: `npm run dev`, visit `/charts/<id>/edit` for the chart created in Task 7 (as its owner).
Expected: form is pre-filled with the chart's title, key, and the chords-over-lyrics textarea shows the chords positioned above the lyrics (not raw ChordPro `[C]` syntax). Change the title, save.
Expected: redirected to `/charts/<id>`, new title shown.

- [ ] **Step 3: Manual verification — access control**

While logged in as the owner, copy the edit URL. Log out, create/log in as a second test user (Supabase dashboard → Authentication → Users → Add user), visit the same `/charts/<id>/edit` URL directly.
Expected: redirected to `/charts/<id>` (view page) — no Edit/Delete buttons visible there either, since this second user is neither the owner nor an admin.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/charts/[id]/edit/page.tsx"
git commit -m "Add chart edit page with owner/admin gating"
```

---

### Task 11: Full manual verification checklist

**Files:**
- None (verification only; fix forward in the relevant task's files if something fails)

**Interfaces:**
- None produced; this is the end-to-end verification of every prior task together, matching the checklist in `docs/specs/chord-chart-management-design.md`.

- [ ] **Step 1: Run through the checklist**

With `npm run dev` running and at least two test user accounts (one admin, one member — reuse chunk 1's admin account and the second test user from Task 10):

- [ ] Create: fill the New form, save, chart appears in the Library
- [ ] Search: search by a partial title and by a partial artist name, both return the right chart; clearing the search shows everything again
- [ ] View: log in as a non-owner, open a chart you don't own — no Edit/Delete buttons shown; log in as the owner — both buttons shown
- [ ] Edit: non-owner hitting `/charts/[id]/edit` directly gets redirected to the view page; owner can load, edit, save, and changes persist and display correctly
- [ ] Soft delete: owner deletes a chart they own — confirm dialog appears, chart disappears from Library/View, but the row still exists in the Supabase Table Editor with `deleted_at` set
- [ ] Paste-and-fix: copy real chords-over-lyrics text from a site like Ultimate Guitar, paste it into the New chart textarea, confirm the chords and lyrics land in a state you can manually straighten out (some misalignment is expected and fine), save, confirm it renders on the View page
- [ ] Section labels: in the editor textarea, add a bare line like `Chorus` above a lyric section, save, then view the chart — confirm "Chorus" renders visually distinct (e.g. bold) from the lyric lines, not as an ordinary lyric line
- [ ] Inline chord notation: include a slash chord (e.g. `C/D`) and a flat (e.g. `Bb`) in the textarea, save, confirm both appear unchanged on the View page and when reopening Edit
- [ ] RLS: using the Supabase JS client directly (a scratch script, or the browser console while logged in as the non-owner test user) attempt `supabase.from('charts').update({ title: 'hacked' }).eq('id', '<a chart owned by someone else>')` — confirm it's rejected (no rows affected) at the DB level, not just hidden by the UI
- [ ] Ownerless chart: in the SQL Editor, run `update public.charts set owner_id = null where id = '<test chart id>';` — confirm a non-admin now sees no Edit/Delete on that chart, and the admin test account does
- [ ] FK behavior: in a disposable test chart/user (not your real account), delete the test user's `auth.users` row via the dashboard — confirm their chart survives with `owner_id` now `null`, rather than the chart disappearing

- [ ] **Step 2: Update the chunk roadmap**

In `docs/chunks-roadmap.md`, update chunk 3's row: change `Status` to `✅ Done` and add the impl plan link:
```
| 3 | Chord Chart Management (core CRUD, ChordPro editor, paste-and-fix) | §6.1 | ✅ Done | [chord-chart-management-design.md](specs/chord-chart-management-design.md) | [chord-chart-management-plan.md](impl-plans/chord-chart-management-plan.md) |
```

- [ ] **Step 3: Commit**

```bash
git add docs/chunks-roadmap.md
git commit -m "Mark chord chart management chunk as done"
```
