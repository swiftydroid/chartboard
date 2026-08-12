# Design: Chord Chart Management (Chunk 3)

**Status:** Approved
**Date:** 2026-08-12
**Related:** [PRD §6.1 Chord Chart Management](../prd.md#61-chord-chart-management), [chunk roadmap](../chunks-roadmap.md)

## Purpose

Establish core chord chart CRUD, a ChordPro-based editor, and the paste-and-fix workflow described in PRD §6.1. This is the first chunk to introduce real app content (charts) on top of the auth/access foundation from chunk 1.

**Scope for this chunk:** create, view, edit (owner-only), delete (owner-only), and search charts; manual entry and paste-and-fix both go through the same chords-over-lyrics editor.

**Explicitly out of scope** (deferred to later chunks per the roadmap):
- Transpose (chunk 4)
- Version history / "non-owner creates a new version instead of editing" (chunk 4) — for this chunk, only the owner can edit; non-owners can view but not modify or fork
- Annotations / private highlighting (chunk 5)
- Setlists, and "delete removes chart from any setlists that referenced it" (chunk 6) — not applicable yet, no setlists exist
- Admin delete-any-chart override (chunk 9) — delete is owner-only in this chunk's RLS

## Architecture

**Stack:** unchanged from chunk 1 — Next.js 16 (App Router, TypeScript), Supabase (Postgres + Auth), Tailwind + shadcn/ui, deployed to Vercel.

**New dependency:** [`chordsheetjs`](https://github.com/martijnversluis/ChordSheetJS) — parses/formats ChordPro and chords-over-words chord sheet text; provides the `ChordsOverWordsParser`, `ChordProParser`, `ChordProFormatter`, `ChordsOverWordsFormatter`, and `HtmlDivFormatter` used below. ChordPro is the storage format because it is the de facto open, portable, plain-text standard for chord sheets, and it's what ChordSheetJS's transpose/rendering tooling (needed in chunk 4) expects natively.

### Data model

New migration `supabase/migrations/0002_charts.sql`:

```sql
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
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Field notes:
- `artists` — nullable `text[]`. Multiple artists are supported (e.g. covers, duets) as a simple array rather than a normalized join table; at this app's scale (no per-artist metadata, no artist detail pages) a join table would add a table, an RLS policy, and join queries for every list/search with no present benefit. Search matches if any element contains the query.
- `genre` — nullable, DB check constraint against the fixed 14-value list. Displayed in the UI alphabetically with "Other" pinned last, per standard categorical-dropdown convention.
- `key` — **not null**, DB check constraint against the 24-value chromatic list (12 majors, sharps only, then the same 12 roots suffixed `m` for minor — no flats). Required so the transpose feature (chunk 4) always has a known starting key to transpose from. Displayed in the UI in chromatic order (C, C#, D, D#, E, F, F#, G, G#, A, A#, B), majors before minors — matches piano-key layout and what most chord-chart apps (e.g. SongSelect) default to.
- `tempo` — nullable integer (BPM).
- `time_signature` — nullable, DB check constraint against `('4/4','3/4','2/4','6/8','12/8')`, displayed in that order (most-to-least common, per standard music theory frequency).
- `content` — ChordPro-formatted chart body.
- Check constraints are used (not app-layer-only validation) because they're cheap for `key`/`time_signature` (fixed by music theory, will never change) and, for `genre`, a one-line migration to extend later while still guaranteeing no bad data can land even from a future code path that bypasses the normal UI (script, admin tool, bug).

`updated_at` bumped via trigger, following the same pattern as `profiles`.

**RLS:**
- SELECT: any authenticated user (chart library is visible to all logged-in users per PRD §6.4 — not restricted to the owner)
- INSERT: any authenticated user, policy enforces `owner_id = auth.uid()`
- UPDATE: `owner_id = auth.uid()` only
- DELETE: `owner_id = auth.uid()` only (admin-delete-any is chunk 9 — not built here, so no admin bypass in this policy yet)

### ChordSheetJS integration

`lib/chords/convert.ts` — a thin wrapper module around ChordSheetJS. All four route/component call sites (create-save, edit-load, edit-save, view-render) go through this module rather than importing ChordSheetJS directly, so parser/formatter setup and the section-label handling below live in one place.

Exports:
- `parseChordsOverWords(text: string): Song` — wraps `ChordsOverWordsParser`, after running the section-label pre-processing pass below
- `toChordPro(song: Song): string` — wraps `ChordProFormatter`
- `parseChordPro(text: string): Song` — wraps `ChordProParser`
- `toChordsOverWords(song: Song): string` — wraps `ChordsOverWordsFormatter`, then reverses the section-label post-processing pass, for populating the edit textarea
- `toDisplayHtml(song: Song): string` — wraps `HtmlDivFormatter`, for the read-only view page (span-based positioning keeps chords aligned above lyrics even with proportional fonts, unlike plain monospace text)

**Section-label handling:** `ChordsOverWordsParser` (used for both manual typing and pasted content, since both go through the same textarea) has no built-in recognition of section labels like "Verse 1", "Chorus:", "[Bridge]" — it would pass them through as an ordinary, undistinguished text line. `lib/chords/convert.ts` handles this itself:
- Before parsing: a line consisting only of a known section keyword (Intro, Verse *N*, Chorus, Pre-Chorus, Bridge, Outro, Tag, Interlude), optionally numbered, with or without a trailing colon or surrounding brackets, is converted to a ChordPro `{comment: ...}` directive. `{comment: ...}` is used rather than matched `{start_of_x}`/`{end_of_x}` pairs because it needs no closing marker — safe against unclosed/malformed sections in free-typed or pasted text — and formatters render comment directives distinctly (e.g. bold) automatically.
- When converting back to chords-over-words for the edit textarea: `{comment: ...}` directives are converted back to a plain label line, so editing round-trips without the user seeing ChordPro syntax.

**Inline chord notation** (e.g. `C/D`, `Bb`, `F#m7`) is left exactly as typed or pasted, with no normalization. This is unrelated to the `key` field's sharps-only dropdown — that constraint applies only to the single structured `key` metadata value. Individual chords in the free-text `content` are whatever the user types; ChordSheetJS's `Chord` class already parses slash chords and both sharp/flat accidentals natively.

## Components / Routes

All new routes live under the existing `(protected)` route group (a Next.js route group — excluded from the URL, purely organizational), so they inherit chunk 1's auth gating (middleware + `(protected)/layout.tsx`'s server-side `getUser()` check) automatically, with no new gating logic required.

- **`app/(protected)/charts/page.tsx`** — Library: searchable list of all charts (title/artists, case-insensitive substring match via ILIKE), showing title/artists/genre/key
- **`app/(protected)/charts/new/page.tsx`** — Create: metadata form (title, optional artists, optional genre, required key, optional tempo/time signature) plus a chords-over-lyrics `Textarea`. Manual typing and pasted Ultimate-Guitar-style text both go into this same field — there is no separate "paste mode."
- **`app/(protected)/charts/[id]/page.tsx`** — View (read-only): fetches the chart (RLS-scoped SELECT, any logged-in user) and renders `content` via `toDisplayHtml`. Shows Edit/Delete buttons only if `owner_id === current user`.
- **`app/(protected)/charts/[id]/edit/page.tsx`** — Edit (owner-only): loads the chart, converts `content` → chords-over-lyrics text via `toChordsOverWords` to prefill the textarea, alongside the same metadata form pre-filled. A server-side ownership check redirects non-owners to the view page.

## Data Flow

1. **Create:** user fills the New form and the textarea → on submit, `parseChordsOverWords(text)` → `toChordPro(song)` → insert row with `owner_id = auth.uid()` → redirect to `/charts/[id]`.
2. **Paste-and-fix:** pasting Ultimate-Guitar-style text is just typing/pasting into the same textarea used for manual entry. `ChordsOverWordsParser` does best-effort chord/lyric line detection; the user manually corrects any misaligned chords in the textarea before submitting, per the PRD's manual-correction workflow — no auto-fix UI.
3. **View:** fetch chart by id → `parseChordPro(content)` → `toDisplayHtml(song)` → rendered read-only.
4. **Edit:** owner-only. Load chart → `parseChordPro(content)` → `toChordsOverWords(song)` → populate textarea and metadata form → on submit, same convert-and-save path as Create, but UPDATE instead of INSERT.
5. **Delete:** owner-only action from View → confirm dialog → delete row. "Remove from any setlists that referenced it" is not applicable yet (no setlists exist until chunk 6).

## Error Handling

- **Non-owner hits `/charts/[id]/edit` directly:** server-side ownership check redirects to the view page; the RLS UPDATE policy is the real backstop if this check is ever bypassed, per chunk 1's two-layer gating pattern.
- **Malformed/unparseable paste content:** `ChordsOverWordsParser` is best-effort and won't throw on odd input — worst case it misclassifies a line as lyric vs. chord, which the user fixes manually in the textarea. If a genuine parse exception does occur, it surfaces as a generic inline error on submit and the chart is not saved.
- **RLS denies a write** (e.g. an ownership race, or a bug): generic inline "something went wrong" error, matching chunk 1's convention — not expected in normal operation.
- **Missing required field** (title, key): client-side form validation blocks submit before it reaches the server.

## Testing

Following chunk 1's convention: minimal testing of glue code against Supabase (verified manually — a mocked test would just re-assert the mock, not catch real RLS bugs), but real unit tests for pure logic with genuine edge cases.

**Unit tested (Vitest)** — `lib/chords/convert.ts`:
- Section-label detection: matches "Verse 1", "Chorus:", "[Bridge]", "Pre-Chorus", etc., converts to `{comment: ...}` on save; does not false-positive on an ordinary lyric line that happens to contain a keyword mid-sentence.
- Round-trip: `toChordsOverWords(parseChordPro(x))` reproduces an editable equivalent of `x` (chords stay aligned, section comments come back as plain label lines) — this is what makes Edit safe to build on.
- Slash chords and flats pass through `parseChordsOverWords` → `toChordPro` unchanged.

**Manual verification checklist:**
- Create: fill form, save, appears in Library
- Search: title/artists substring match, case-insensitive
- View: non-owner can view but sees no Edit/Delete; owner sees both
- Edit: non-owner hitting `/charts/[id]/edit` directly gets redirected; owner can load, edit, save, changes persist
- Delete: owner can delete; confirm dialog present
- Paste-and-fix: paste real Ultimate Guitar text, confirm chords/lyrics land in the textarea in a fixable state
- RLS: attempt an UPDATE/DELETE on a chart you don't own via a raw Supabase client call (e.g. a scratch script) — confirm it's rejected at the DB level, not just hidden by the UI
